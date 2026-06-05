import type { Code, Html, Root } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki';
import { cassetteShiki } from '@worldsmythe/code-shell';

declare module 'mdast' {
    interface Data {
        hName?: string;
        hProperties?: Record<string, unknown>;
    }
}

const PRE_OPEN = /^<pre\b[^>]*>/;
const CODE_OPEN = /^<code\b[^>]*>/;
const SUPPORTED_LANGS = new Set<string>(Object.keys(bundledLanguages));

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveLang(lang: string | null | undefined): BundledLanguage | 'text' {
    if (!lang) return 'text';
    const normalized = lang.toLowerCase();
    if (SUPPORTED_LANGS.has(normalized)) return normalized as BundledLanguage;
    return 'text';
}

function parseActiveLines(meta: string | null | undefined): Set<number> {
    const out = new Set<number>();
    if (!meta) return out;
    const match = meta.match(/\{([\d,\-\s]+)\}/);
    if (!match) return out;
    for (const part of match[1].split(',')) {
        const segment = part.trim();
        const range = segment.match(/^(\d+)-(\d+)$/);
        if (range) {
            for (let i = Number(range[1]); i <= Number(range[2]); i++) out.add(i);
        } else if (/^\d+$/.test(segment)) {
            out.add(Number(segment));
        }
    }
    return out;
}

/**
 * Runs a code value through Shiki with the site theme and returns the inner
 * per-line spans, stripped of Shiki's outer `<pre>`/`<code>` wrappers.
 */
async function highlightToLines(value: string, lang: string | null | undefined): Promise<string> {
    const cleaned = value.replace(/^(?:[ \t]*\n)+/, '');
    const html = await codeToHtml(cleaned, { lang: resolveLang(lang), theme: cassetteShiki });

    let inner = html;
    const preMatch = inner.match(PRE_OPEN);
    if (preMatch) inner = inner.slice(preMatch[0].length);
    if (inner.endsWith('</pre>')) inner = inner.slice(0, -'</pre>'.length);
    const codeMatch = inner.match(CODE_OPEN);
    if (codeMatch) inner = inner.slice(codeMatch[0].length);
    if (inner.endsWith('</code>')) inner = inner.slice(0, -'</code>'.length);
    return inner;
}

/**
 * Stamps `data-line` on every Shiki line span and `data-active` on the lines in
 * `active`. Active line numbers past the end (a cursor that has stepped beyond
 * the last line) are appended as empty active rows.
 */
function stampLines(inner: string, active: Set<number>): string {
    let lineIndex = 0;
    let out = '';
    for (const part of inner.split(/(?=<span class="line")/)) {
        if (!part.startsWith('<span class="line"')) {
            out += part;
            continue;
        }
        lineIndex += 1;
        const index = lineIndex;
        const mark = active.has(index) ? ' data-active="true"' : '';
        out += part.replace(
            /^<span class="line"([^>]*)>/,
            (_match, attrs: string) => `<span class="line" data-line="${index}"${mark}${attrs}>`,
        );
    }
    const maxActive = active.size ? Math.max(...active) : 0;
    for (let n = lineIndex + 1; n <= maxActive; n++) {
        const mark = active.has(n) ? ' data-active="true"' : '';
        out += `<span class="line" data-line="${n}"${mark}></span>`;
    }
    return out;
}

async function renderTrace(directive: ContainerDirective): Promise<string> {
    const title = directive.attributes?.title ?? '';
    const codes = directive.children.filter((child): child is Code => child.type === 'code');
    const [state, source] = codes;

    const panes: string[] = [];
    if (state) {
        const inner = await highlightToLines(state.value, state.lang);
        panes.push(`<pre class="trace__pane trace__state"><code>${inner}</code></pre>`);
    }
    if (source) {
        const inner = await highlightToLines(source.value, source.lang);
        const stamped = stampLines(inner, parseActiveLines(source.meta));
        panes.push(`<pre class="trace__pane trace__src"><code>${stamped}</code></pre>`);
    }

    const header = title
        ? `<header class="trace__bar"><span class="trace__title">${escapeHtml(title)}</span></header>`
        : '';
    return header + panes.join('');
}

/**
 * Renders a `:::trace` container directive as a two-pane state/execution frame.
 * The first fenced code block becomes the state pane, the second becomes the
 * source pane whose `{N}` meta marks the active (executing) line. Both panes are
 * highlighted with the shared Shiki theme.
 */
export const remarkTrace: Plugin<[], Root> = () => {
    return async (tree) => {
        const directives: ContainerDirective[] = [];
        visit(tree, 'containerDirective', (directive: ContainerDirective) => {
            if (directive.name === 'trace') directives.push(directive);
        });

        const rendered = await Promise.all(directives.map(renderTrace));

        for (let i = 0; i < directives.length; i++) {
            const directive = directives[i];
            const data = directive.data ?? (directive.data = {});
            data.hName = 'figure';
            data.hProperties = { className: ['trace'] };
            const child: Html = { type: 'html', value: rendered[i] };
            directive.children = [child];
        }
    };
};

export default remarkTrace;

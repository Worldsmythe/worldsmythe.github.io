import type { Root, Code } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki';
import { cassetteShiki } from '../themes/cassette-shiki';

interface FenceMeta {
    title?: string;
    highlights: Set<number>;
    ins: Set<number>;
    del: Set<number>;
    focus: Set<number>;
    collapse: Set<number>;
}

function parseRanges(spec: string): Set<number> {
    const out = new Set<number>();
    for (const part of spec.split(',')) {
        const segment = part.trim();
        const range = segment.match(/^(\d+)-(\d+)$/);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            for (let i = start; i <= end; i++) out.add(i);
        } else if (/^\d+$/.test(segment)) {
            out.add(Number(segment));
        }
    }
    return out;
}

function parseNamed(raw: string, key: string): Set<number> {
    const match = raw.match(new RegExp(`${key}=\\{([\\d,\\-\\s]+)\\}`));
    return match ? parseRanges(match[1]) : new Set<number>();
}

function parseMeta(raw: string | null | undefined): FenceMeta {
    const meta: FenceMeta = {
        highlights: new Set(),
        ins: new Set(),
        del: new Set(),
        focus: new Set(),
        collapse: new Set(),
    };
    if (!raw) return meta;

    const titleMatch = raw.match(/title\s*=\s*"([^"]+)"/);
    if (titleMatch) meta.title = titleMatch[1];

    meta.ins = parseNamed(raw, 'ins');
    meta.del = parseNamed(raw, 'del');
    meta.focus = parseNamed(raw, 'focus');
    meta.collapse = parseNamed(raw, 'collapse');

    // bare {…} (and mark={…}) are highlights; strip named ranges first so their
    // braces aren't mistaken for the bare highlight range.
    meta.highlights = parseNamed(raw, 'mark');
    const stripped = raw.replace(/\w+=\{[\d,\-\s]+\}/g, '');
    const bare = stripped.match(/\{([\d,\-\s]+)\}/);
    if (bare) {
        for (const n of parseRanges(bare[1])) meta.highlights.add(n);
    }

    return meta;
}

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PRE_OPEN = /^<pre\b[^>]*>/;
const CODE_OPEN = /^<code\b[^>]*>/;
const SUPPORTED_LANGS = new Set<string>(Object.keys(bundledLanguages));

function resolveLang(lang: string | null | undefined): BundledLanguage | 'text' {
    if (!lang) return 'text';
    const normalized = lang.toLowerCase();
    if (SUPPORTED_LANGS.has(normalized)) return normalized as BundledLanguage;
    return 'text';
}

function groupRuns(set: Set<number>): Array<[number, number]> {
    const nums = [...set].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    for (const n of nums) {
        const last = runs[runs.length - 1];
        if (last && n === last[1] + 1) last[1] = n;
        else runs.push([n, n]);
    }
    return runs;
}

function foldOpen(count: number): string {
    const label = `${count} ${count === 1 ? 'line' : 'lines'} hidden`;
    return (
        '<span class="code-fold" data-open="false">' +
        '<button class="code-fold__toggle" type="button" aria-expanded="false">' +
        '<span class="code-fold__chev" aria-hidden="true">▸</span>' +
        `<span class="code-fold__label">${label}</span>` +
        '</button>' +
        '<span class="code-fold__wrap"><span class="code-fold__lines">'
    );
}

const FOLD_CLOSE = '</span></span></span>';

/**
 * Rewrites the per-line spans Shiki produced: stamps `data-line` plus the
 * highlight/diff/focus markers, and wraps each contiguous `collapse` range in a
 * clickable fold that starts closed. Folds use overflow collapse rather than
 * `display:none` so the line-number counter stays continuous when closed.
 */
function processLines(inner: string, meta: FenceMeta): string {
    const foldStart = new Map<number, number>();
    const foldEnd = new Set<number>();
    for (const [start, end] of groupRuns(meta.collapse)) {
        foldStart.set(start, end - start + 1);
        foldEnd.add(end);
    }

    let lineIndex = 0;
    let open = false;
    let out = '';
    for (const part of inner.split(/(?=<span class="line")/)) {
        if (!part.startsWith('<span class="line"')) {
            out += part;
            continue;
        }
        lineIndex += 1;
        const piece = part.replace(/^<span class="line"([^>]*)>/, (_match, attrs: string) => {
            let marks = '';
            if (meta.highlights.has(lineIndex)) marks += ' data-highlighted="true"';
            if (meta.ins.has(lineIndex)) marks += ' data-ins="true"';
            if (meta.del.has(lineIndex)) marks += ' data-del="true"';
            if (meta.focus.size > 0 && !meta.focus.has(lineIndex)) marks += ' data-faded="true"';
            return `<span class="line" data-line="${lineIndex}"${marks}${attrs}>`;
        });
        const count = foldStart.get(lineIndex);
        if (count !== undefined) {
            out += foldOpen(count);
            open = true;
        }
        out += piece;
        if (open && foldEnd.has(lineIndex)) {
            out += FOLD_CLOSE;
            open = false;
        }
    }
    if (open) out += FOLD_CLOSE;
    return out;
}

async function renderShell(node: Code): Promise<string> {
    const meta = parseMeta(node.meta);
    const lang = resolveLang(node.lang);
    const value = (node.value ?? '')
        .replace(/^(?:[ \t]*\n)+/, '')
        .replace(/(?:\n[ \t]*)+$/, '');

    const html = await codeToHtml(value, {
        lang,
        theme: cassetteShiki,
    });

    let inner = html;
    const preMatch = inner.match(PRE_OPEN);
    if (preMatch) inner = inner.slice(preMatch[0].length);
    if (inner.endsWith('</pre>')) inner = inner.slice(0, -'</pre>'.length);
    const codeMatch = inner.match(CODE_OPEN);
    if (codeMatch) inner = inner.slice(codeMatch[0].length);
    if (inner.endsWith('</code>')) inner = inner.slice(0, -'</code>'.length);

    const hasMarkers =
        meta.highlights.size > 0 || meta.ins.size > 0 || meta.del.size > 0 || meta.focus.size > 0;
    if (hasMarkers || meta.collapse.size > 0) {
        inner = processLines(inner, meta);
    }
    const focusAttr = meta.focus.size > 0 ? ' data-has-focus="true"' : '';

    const langLabel = (node.lang ?? 'text').toUpperCase();
    const titleHtml = meta.title
        ? `<span class="code-shell__title">${escapeHtml(meta.title)}</span>`
        : '';

    return [
        `<figure class="code-shell" data-lang="${escapeHtml(node.lang ?? 'text')}"${focusAttr}>`,
        `<header class="code-shell__bar">`,
        `<span class="code-shell__tag">[ ${escapeHtml(langLabel)} ]</span>`,
        titleHtml,
        `<span class="code-shell__rule" aria-hidden="true"></span>`,
        `<button class="code-shell__copy" type="button">Copy</button>`,
        `</header>`,
        `<pre class="code-shell__body" tabindex="0"><code class="code-shell__code">${inner}</code></pre>`,
        `<footer class="code-shell__corners" aria-hidden="true"></footer>`,
        `</figure>`,
    ].join('');
}

export const remarkCodeShell: Plugin<[], Root> = () => {
    return async (tree) => {
        const nodes: Array<{ node: Code; parent: { children: unknown[] }; index: number }> = [];

        visit(tree, 'code', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return;
            nodes.push({ node, parent: parent as { children: unknown[] }, index });
        });

        const rendered = await Promise.all(nodes.map(({ node }) => renderShell(node)));

        for (let i = 0; i < nodes.length; i++) {
            const { parent, index } = nodes[i];
            parent.children[index] = { type: 'html', value: rendered[i] };
        }
    };
};

export default remarkCodeShell;

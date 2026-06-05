import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Root, Code } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki';
import { cassetteShiki } from './theme';
import { syntaxCollapse } from './collapse';
import { buildDiff } from './diff';
import { resolveLanguage } from './languages';

interface FenceMeta {
    title?: string;
    src?: string;
    before?: string;
    after?: string;
    highlights: Set<number>;
    ins: Set<number>;
    del: Set<number>;
    focus: Set<number>;
    collapse: Set<number>;
    hasIns: boolean;
    hasDel: boolean;
    hasCollapse: boolean;
    collapsed: boolean;
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

function hasNamed(raw: string, key: string): boolean {
    return new RegExp(`${key}=\\{[\\d,\\-\\s]+\\}`).test(raw);
}

function parseString(raw: string, key: string): string | undefined {
    const match = raw.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]+)"`));
    return match ? match[1] : undefined;
}

function parseMeta(raw: string | null | undefined): FenceMeta {
    const meta: FenceMeta = {
        highlights: new Set(),
        ins: new Set(),
        del: new Set(),
        focus: new Set(),
        collapse: new Set(),
        hasIns: false,
        hasDel: false,
        hasCollapse: false,
        collapsed: false,
    };
    if (!raw) return meta;

    meta.title = parseString(raw, 'title');
    meta.src = parseString(raw, 'src');
    meta.before = parseString(raw, 'before');
    meta.after = parseString(raw, 'after');

    meta.hasIns = hasNamed(raw, 'ins');
    meta.hasDel = hasNamed(raw, 'del');
    meta.hasCollapse = hasNamed(raw, 'collapse');

    // `collapsed` (no value) folds the whole block; `collapse={…}` (with value)
    // folds line ranges. The trailing word boundary keeps them distinct.
    meta.collapsed = /\bcollapsed\b/.test(raw);

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

function normalizeSource(content: string): string {
    return content.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

/** Reads a fence-referenced file relative to the post, refusing paths outside the project root. */
async function loadSource(baseDir: string, ref: string, root: string): Promise<string> {
    const resolved = resolve(baseDir, ref);
    const rel = relative(root, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
        throw new Error(`remark-code-shell: refusing to read "${ref}" outside the project root`);
    }
    return normalizeSource(await readFile(resolved, 'utf8'));
}

function measureIndent(line: string): number {
    let n = 0;
    for (const ch of line) {
        if (ch === ' ') n += 1;
        else if (ch === '\t') n += 4;
        else break;
    }
    return n;
}

const CONTEXT = 2;
const MIN_RUN = 4;

/**
 * Indentation-based fallback for `syntaxCollapse`, used when no tree-sitter grammar
 * matches the fence language. Keeps changed lines plus context and, for each, the
 * chain of enclosing scope lines both above (openers) and below (closers) by
 * indentation, then collapses the remaining fully-unchanged runs of at least
 * MIN_RUN lines. Less precise than the syntax pass — it can mistake template-literal
 * contents for scope — but language-agnostic.
 */
function autoCollapse(lines: string[], changed: number[]): Set<number> {
    const N = lines.length;
    const keep = new Set<number>();
    for (const c of changed) {
        for (let i = c - CONTEXT; i <= c + CONTEXT; i++) {
            if (i >= 1 && i <= N) keep.add(i);
        }
    }

    const indent = lines.map(measureIndent);
    const walkScope = (from: number, step: number) => {
        let cur = indent[from - 1];
        for (let j = from + step; j >= 1 && j <= N; j += step) {
            if (lines[j - 1].trim() === '') continue;
            if (indent[j - 1] < cur) {
                keep.add(j);
                cur = indent[j - 1];
                if (cur === 0) break;
            }
        }
    };
    for (const k of [...keep].sort((a, b) => a - b)) {
        walkScope(k, -1);
        walkScope(k, 1);
    }

    const collapse = new Set<number>();
    let run: number[] = [];
    const flush = () => {
        if (run.length >= MIN_RUN) for (const n of run) collapse.add(n);
        run = [];
    };
    for (let i = 1; i <= N; i++) {
        if (keep.has(i)) flush();
        else run.push(i);
    }
    flush();
    return collapse;
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

function stripWrappers(html: string): string {
    let inner = html;
    const preMatch = inner.match(PRE_OPEN);
    if (preMatch) inner = inner.slice(preMatch[0].length);
    if (inner.endsWith('</pre>')) inner = inner.slice(0, -'</pre>'.length);
    const codeMatch = inner.match(CODE_OPEN);
    if (codeMatch) inner = inner.slice(codeMatch[0].length);
    if (inner.endsWith('</code>')) inner = inner.slice(0, -'</code>'.length);
    return inner;
}

/** Splits a Shiki body into its per-line `<span class="line">` strings, one per source line. */
function extractLineSpans(inner: string): string[] {
    const spans: string[] = [];
    for (const part of inner.split(/(?=<span class="line")/)) {
        if (!part.startsWith('<span class="line"')) continue;
        spans.push(part.replace(/\s+$/, ''));
    }
    return spans;
}

async function renderShell(node: Code, baseDir: string, root: string): Promise<string> {
    const meta = parseMeta(node.meta);
    const lang = resolveLang(node.lang);
    const highlight = (code: string) => codeToHtml(code, { lang, theme: cassetteShiki });

    let inner: string;
    if (meta.before && meta.after) {
        const before = await loadSource(baseDir, meta.before, root);
        const after = await loadSource(baseDir, meta.after, root);
        const diff = await buildDiff(before, after, node.lang);
        if (!meta.hasIns) meta.ins = diff.ins;
        if (!meta.hasDel) meta.del = diff.del;
        // Manual `collapse={…}` augments the auto folds rather than replacing them,
        // so a block can hand-collapse extra runs (e.g. comment removals) on top.
        const autoFolds =
            (await syntaxCollapse(diff.lines.join('\n'), node.lang, diff.changed)) ??
            autoCollapse(diff.lines, diff.changed);
        for (const line of autoFolds) meta.collapse.add(line);

        // Highlight each version as a complete, valid file so changed function
        // headers tokenize correctly, then stitch the per-line spans into the diff
        // view. Falls back to highlighting the combined text if the span counts
        // don't line up with the diff (e.g. an empty source).
        const beforeSpans = extractLineSpans(stripWrappers(await highlight(before)));
        const afterSpans = extractLineSpans(stripWrappers(await highlight(after)));
        const stitched = diff.origins.map((o) =>
            o.from === 'before' ? beforeSpans[o.idx] : afterSpans[o.idx],
        );
        inner = stitched.every((s) => s !== undefined)
            ? stitched.join('\n')
            : stripWrappers(await highlight(diff.lines.join('\n')));
    } else {
        const value = meta.src
            ? await loadSource(baseDir, meta.src, root)
            : (node.value ?? '').replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
        inner = stripWrappers(await highlight(value));
    }

    if (!meta.title) {
        const ref = meta.after ?? meta.src;
        if (ref) meta.title = basename(ref);
    }

    const hasMarkers =
        meta.highlights.size > 0 || meta.ins.size > 0 || meta.del.size > 0 || meta.focus.size > 0;
    if (hasMarkers || meta.collapse.size > 0) {
        inner = processLines(inner, meta);
    }
    const focusAttr = meta.focus.size > 0 ? ' data-has-focus="true"' : '';

    const language = resolveLanguage(node.lang);
    const titleHtml = meta.title
        ? `<span class="code-shell__title">${escapeHtml(meta.title)}</span>`
        : '';

    const lineCount = (inner.match(/<span class="line"/g) ?? []).length;
    const collapseAttr = meta.collapsed ? ' data-collapsible="true" data-open="false"' : '';
    const body = `<pre class="code-shell__body" tabindex="0"><code class="code-shell__code">${inner}</code></pre>`;
    const toggleHtml = meta.collapsed
        ? `<div class="code-shell__fold"><div class="code-shell__foldinner">${body}</div></div>` +
          '<button class="code-shell__expand" type="button" aria-expanded="false">' +
          '<span class="code-shell__chev" aria-hidden="true">▸</span>' +
          `<span class="code-shell__expand-label">${lineCount} ${lineCount === 1 ? 'line' : 'lines'} hidden</span>` +
          '</button>'
        : body;

    return [
        `<figure class="code-shell" data-lang="${escapeHtml(node.lang ?? 'text')}" style="--lang-color:${language.color}"${focusAttr}${collapseAttr}>`,
        `<header class="code-shell__bar">`,
        `<span class="code-shell__tag">[ ${escapeHtml(language.name)} ]</span>`,
        titleHtml,
        `<span class="code-shell__rule" aria-hidden="true"></span>`,
        `<button class="code-shell__copy" type="button">Copy</button>`,
        `</header>`,
        toggleHtml,
        `<footer class="code-shell__corners" aria-hidden="true"></footer>`,
        `</figure>`,
    ].join('');
}

export const remarkCodeShell: Plugin<[], Root> = () => {
    return async (tree, file) => {
        const mdPath = file.path ?? '';
        const root = file.cwd ?? process.cwd();
        const baseDir = mdPath ? dirname(mdPath) : root;

        const nodes: Array<{ node: Code; parent: { children: unknown[] }; index: number }> = [];

        visit(tree, 'code', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return;
            nodes.push({ node, parent: parent as { children: unknown[] }, index });
        });

        const rendered = await Promise.all(
            nodes.map(({ node }) => renderShell(node, baseDir, root)),
        );

        for (let i = 0; i < nodes.length; i++) {
            const { parent, index } = nodes[i];
            parent.children[index] = { type: 'html', value: rendered[i] };
        }
    };
};

export default remarkCodeShell;

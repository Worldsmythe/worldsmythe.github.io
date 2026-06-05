import { diffLines } from 'diff';
import type Parser from 'web-tree-sitter';
import { withTree } from './parser';

export type LineOrigin = { from: 'before' | 'after'; idx: number };

export interface DiffResult {
    lines: string[];
    origins: LineOrigin[];
    ins: Set<number>;
    del: Set<number>;
    changed: number[];
}

type Op = { type: 'context' | 'del' | 'add'; line: string };
type Line = { text: string; anchorable: boolean; declId?: string };

// Node types whose interior lines are content (strings, comments) rather than
// structure — excluded as diff anchors so a moved string block isn't matched.
const OPAQUE = new Set([
    'string',
    'string_literal',
    'template_string',
    'raw_string_literal',
    'concatenated_string',
    'comment',
    'block_comment',
    'line_comment',
    'heredoc_body',
]);

// Declarations with a `name` field — always identify-able regardless of nesting.
const NAMED_DECL = new Set([
    'function_declaration',
    'generator_function_declaration',
    'class_declaration',
    'abstract_class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
]);

/** Returns the declaration identity a line introduces (e.g. `function:parseIndented`,
 * `member:Input`), used to align declarations across a change even when the header
 * line itself changed. Local variables inside a body are skipped — their names are
 * too generic to anchor on. */
function declOf(node: Parser.SyntaxNode, inBody: boolean): string | undefined {
    if (NAMED_DECL.has(node.type)) {
        const name = node.childForFieldName('name')?.text;
        return name ? `${node.type}:${name}` : undefined;
    }
    if (inBody) return undefined;
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
        const declarator = node.namedChildren.find((c) => c.type === 'variable_declarator');
        const name = declarator?.childForFieldName('name')?.text;
        return name ? `var:${name}` : undefined;
    }
    if (node.type === 'pair') {
        const key = node.childForFieldName('key')?.text;
        return key ? `member:${key}` : undefined;
    }
    if (node.type === 'method_definition' || node.type === 'public_field_definition') {
        const name = node.childForFieldName('name')?.text;
        return name ? `member:${name}` : undefined;
    }
    return undefined;
}

interface Analysis {
    anchorable: boolean[];
    declId: Array<string | undefined>;
}

/** Parses a source and returns, per line, whether it may anchor a diff and any
 * declaration identity it introduces. */
function analyze(source: string, lang: string | null | undefined): Promise<Analysis | null> {
    const count = source.split('\n').length;
    return withTree(source, lang, (tree): Analysis => {
        const opaque = new Array<boolean>(count).fill(false);
        const declId = new Array<string | undefined>(count).fill(undefined);
        const walk = (node: Parser.SyntaxNode, inBody: boolean) => {
            if (OPAQUE.has(node.type)) {
                for (let r = node.startPosition.row + 1; r < node.endPosition.row; r++) {
                    if (r >= 0 && r < count) opaque[r] = true;
                }
                return;
            }
            const id = declOf(node, inBody);
            if (id) {
                const row = node.startPosition.row;
                if (row >= 0 && row < count) declId[row] = id;
            }
            const childInBody = inBody || node.type === 'statement_block';
            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i);
                if (child) walk(child, childInBody);
            }
        };
        walk(tree.rootNode, false);
        return { anchorable: opaque.map((o) => !o), declId };
    });
}

function jsdiffOps(before: string, after: string): Op[] {
    const ops: Op[] = [];
    for (const part of diffLines(before, after)) {
        const lines = part.value.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
        const type = part.added ? 'add' : part.removed ? 'del' : 'context';
        for (const line of lines) ops.push({ type, line });
    }
    return ops;
}

/** Longest increasing subsequence of anchors by their `after` index (patience sort). */
function lis(anchors: Array<{ ai: number; bi: number }>): Array<{ ai: number; bi: number }> {
    const piles: number[] = [];
    const back: number[] = [];
    for (let i = 0; i < anchors.length; i++) {
        const bi = anchors[i].bi;
        let lo = 0;
        let hi = piles.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (anchors[piles[mid]].bi < bi) lo = mid + 1;
            else hi = mid;
        }
        back[i] = lo > 0 ? piles[lo - 1] : -1;
        piles[lo] = i;
    }
    const seq: Array<{ ai: number; bi: number }> = [];
    let k = piles.length ? piles[piles.length - 1] : -1;
    while (k !== -1) {
        seq.push(anchors[k]);
        k = back[k];
    }
    return seq.reverse();
}

function uniqueCommon<T>(
    a: Line[],
    b: Line[],
    key: (line: Line) => T | undefined,
): { posB: Map<T, number>; countA: Map<T, number>; countB: Map<T, number> } {
    const countA = new Map<T, number>();
    const countB = new Map<T, number>();
    for (const x of a) {
        const k = key(x);
        if (k !== undefined) countA.set(k, (countA.get(k) ?? 0) + 1);
    }
    const posB = new Map<T, number>();
    b.forEach((x, i) => {
        const k = key(x);
        if (k === undefined) return;
        countB.set(k, (countB.get(k) ?? 0) + 1);
        if (!posB.has(k)) posB.set(k, i);
    });
    return { posB, countA, countB };
}

/**
 * Patience diff over lines, anchoring on (a) lines unique among the anchorable
 * (non-string/comment) lines of each side, and (b) declarations matched by identity
 * — so a declaration whose signature changed aligns to itself (its header reads as a
 * del/add pair) instead of being lumped into a neighbouring addition. Gaps with no
 * anchors fall back to jsdiff, except pure add/remove gaps which are emitted directly.
 */
function patienceOps(a: Line[], b: Line[]): Op[] {
    const ops: Op[] = [];
    const recur = (aSeg: Line[], bSeg: Line[]) => {
        let pre = 0;
        while (pre < aSeg.length && pre < bSeg.length && aSeg[pre].text === bSeg[pre].text) {
            ops.push({ type: 'context', line: aSeg[pre].text });
            pre += 1;
        }
        aSeg = aSeg.slice(pre);
        bSeg = bSeg.slice(pre);

        let suf = 0;
        while (
            suf < aSeg.length &&
            suf < bSeg.length &&
            aSeg[aSeg.length - 1 - suf].text === bSeg[bSeg.length - 1 - suf].text
        ) {
            suf += 1;
        }
        const suffix = aSeg.slice(aSeg.length - suf);
        const aMid = aSeg.slice(0, aSeg.length - suf);
        const bMid = bSeg.slice(0, bSeg.length - suf);

        const text = uniqueCommon(aMid, bMid, (l) => (l.anchorable ? l.text : undefined));
        const decl = uniqueCommon(aMid, bMid, (l) => l.declId);
        const anchors: Array<{ ai: number; bi: number }> = [];
        aMid.forEach((x, ai) => {
            let bi: number | undefined;
            if (x.anchorable && text.countA.get(x.text) === 1 && text.countB.get(x.text) === 1) {
                bi = text.posB.get(x.text);
            } else if (x.declId && decl.countA.get(x.declId) === 1 && decl.countB.get(x.declId) === 1) {
                bi = decl.posB.get(x.declId);
            }
            if (bi !== undefined) anchors.push({ ai, bi });
        });

        if (anchors.length === 0) {
            // A pure add/remove gap: emit directly. Routing it through jsdiff would
            // join an empty side to '' — which jsdiff reads as one blank line, a
            // phantom that drifts the line counters and misaligns the origins.
            if (aMid.length === 0 || bMid.length === 0) {
                for (const x of aMid) ops.push({ type: 'del', line: x.text });
                for (const x of bMid) ops.push({ type: 'add', line: x.text });
            } else {
                ops.push(
                    ...jsdiffOps(aMid.map((x) => x.text).join('\n'), bMid.map((x) => x.text).join('\n')),
                );
            }
        } else {
            let pa = 0;
            let pb = 0;
            for (const anc of lis(anchors)) {
                recur(aMid.slice(pa, anc.ai), bMid.slice(pb, anc.bi));
                if (aMid[anc.ai].text === bMid[anc.bi].text) {
                    ops.push({ type: 'context', line: aMid[anc.ai].text });
                } else {
                    ops.push({ type: 'del', line: aMid[anc.ai].text });
                    ops.push({ type: 'add', line: bMid[anc.bi].text });
                }
                pa = anc.ai + 1;
                pb = anc.bi + 1;
            }
            recur(aMid.slice(pa), bMid.slice(pb));
        }

        for (const x of suffix) ops.push({ type: 'context', line: x.text });
    };
    recur(a, b);
    return ops;
}

function fromOps(ops: Op[]): DiffResult {
    const lines: string[] = [];
    const origins: LineOrigin[] = [];
    const ins = new Set<number>();
    const del = new Set<number>();
    const changed: number[] = [];
    let lineNo = 0;
    let bIdx = 0;
    let aIdx = 0;
    for (const op of ops) {
        lineNo += 1;
        lines.push(op.line);
        if (op.type === 'del') {
            origins.push({ from: 'before', idx: bIdx++ });
            del.add(lineNo);
            changed.push(lineNo);
        } else if (op.type === 'add') {
            origins.push({ from: 'after', idx: aIdx++ });
            ins.add(lineNo);
            changed.push(lineNo);
        } else {
            origins.push({ from: 'after', idx: aIdx++ });
            bIdx++;
        }
    }
    return { lines, origins, ins, del, changed };
}

/**
 * Diffs two sources into one combined block where removed lines precede their
 * inserted replacements. Uses a syntax- and declaration-anchored patience diff so
 * moved/extracted literals and changed signatures read cleanly; falls back to a
 * line-level jsdiff for languages without a tree-sitter grammar. Returns the 1-based
 * ins/del sets plus, per combined line, which source file and 0-based line it came from.
 */
export async function buildDiff(
    before: string,
    after: string,
    lang: string | null | undefined,
): Promise<DiffResult> {
    const a = await analyze(before, lang);
    const b = await analyze(after, lang);
    if (!a || !b) return fromOps(jsdiffOps(before, after));

    const aLines: Line[] = before
        .split('\n')
        .map((text, i) => ({ text, anchorable: a.anchorable[i], declId: a.declId[i] }));
    const bLines: Line[] = after
        .split('\n')
        .map((text, i) => ({ text, anchorable: b.anchorable[i], declId: b.declId[i] }));
    return fromOps(patienceOps(aLines, bLines));
}

import type Parser from 'web-tree-sitter';
import { withTree } from './parser';

const CONTEXT = 1;
const MIN_RUN = 4;

/**
 * Syntax-aware collapse: parses the (combined) source with tree-sitter and keeps
 * each changed line plus the opener and closer of every enclosing node, then
 * collapses the remaining fully-unchanged runs of at least MIN_RUN lines. Folds
 * align to real syntax — a template literal is one node, not a stack of scopes —
 * so it doesn't mistake string contents for code structure or keep dangling
 * openers. Returns null for languages without a grammar, so the caller can fall
 * back to the indentation heuristic.
 */
export function syntaxCollapse(
    source: string,
    lang: string | null | undefined,
    changed: number[],
): Promise<Set<number> | null> {
    const lines = source.split('\n');
    const N = lines.length;
    return withTree(source, lang, (tree) => {
        const keep = new Set<number>();
        for (const c of changed) {
            keep.add(c);
            for (let d = 1; d <= CONTEXT; d++) {
                if (c - d >= 1) keep.add(c - d);
                if (c + d <= N) keep.add(c + d);
            }
            const line = lines[c - 1] ?? '';
            const column = line.length - line.trimStart().length;
            let node: Parser.SyntaxNode | null = tree.rootNode.descendantForPosition({
                row: c - 1,
                column: Math.max(0, column),
            });
            while (node) {
                const start = node.startPosition.row + 1;
                const end = node.endPosition.row + 1;
                if (end > start) {
                    keep.add(start);
                    keep.add(end);
                }
                node = node.parent;
            }
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
    });
}

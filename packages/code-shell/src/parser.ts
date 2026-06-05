import { createRequire } from 'node:module';
import Parser from 'web-tree-sitter';

const require = createRequire(import.meta.url);

/** Maps a fence language to a tree-sitter grammar shipped by `tree-sitter-wasms`. */
function grammarFor(lang: string | null | undefined): string | null {
    switch ((lang ?? '').toLowerCase()) {
        case 'ts':
        case 'typescript':
        case 'mts':
        case 'cts':
            return 'tree-sitter-typescript';
        case 'tsx':
            return 'tree-sitter-tsx';
        case 'js':
        case 'jsx':
        case 'javascript':
        case 'mjs':
        case 'cjs':
            return 'tree-sitter-javascript';
        case 'bash':
        case 'sh':
        case 'shell':
        case 'zsh':
            return 'tree-sitter-bash';
        case 'py':
        case 'python':
            return 'tree-sitter-python';
        case 'rust':
        case 'rs':
            return 'tree-sitter-rust';
        case 'go':
            return 'tree-sitter-go';
        case 'c':
            return 'tree-sitter-c';
        default:
            return null;
    }
}

let initPromise: Promise<void> | null = null;
let sharedParser: Parser | null = null;
const languages = new Map<string, Promise<Parser.Language>>();

function loadLanguage(grammar: string): Promise<Parser.Language> {
    if (!initPromise) initPromise = Parser.init();
    let lang = languages.get(grammar);
    if (!lang) {
        lang = initPromise.then(() =>
            Parser.Language.load(require.resolve(`tree-sitter-wasms/out/${grammar}.wasm`)),
        );
        languages.set(grammar, lang);
    }
    return lang;
}

/**
 * Parses source with the tree-sitter grammar for `lang` and runs `extract` on the
 * tree, returning its result — or null when no grammar matches or parsing fails,
 * so callers fall back to a language-agnostic path.
 *
 * `extract` runs synchronously in the same continuation as the parse, with no
 * `await` between them. web-tree-sitter shares one WASM heap, so handing a tree
 * back across an `await` lets a concurrent parse (the build renders blocks in
 * parallel) overwrite the heap and corrupt it; keeping parse-and-read atomic
 * avoids that. Parsing is error-tolerant, so even the invalid interleaved diff
 * block still yields usable structure.
 */
export async function withTree<T>(
    source: string,
    lang: string | null | undefined,
    extract: (tree: Parser.Tree) => T,
): Promise<T | null> {
    const grammar = grammarFor(lang);
    if (!grammar) return null;
    let language: Parser.Language;
    try {
        language = await loadLanguage(grammar);
    } catch {
        return null;
    }
    try {
        if (!sharedParser) sharedParser = new Parser();
        sharedParser.setLanguage(language);
        const tree = sharedParser.parse(source);
        const result = extract(tree);
        tree.delete();
        return result;
    } catch {
        return null;
    }
}

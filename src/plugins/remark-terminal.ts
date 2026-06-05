import type { Code, Html, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const LANGS = new Set(['terminal', 'term', 'console', 'shell-session', 'shellsession']);
const PROMPTS = new Set(['$', '#', '❯', '➜']);

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseTitle(raw: string | null | undefined): string | undefined {
    const match = raw?.match(/\btitle\s*=\s*"([^"]+)"/);
    return match ? match[1] : undefined;
}

interface Line {
    prompt?: string;
    text: string;
}

/** Splits a leading prompt glyph (`$`, `#`, …) off a line so it renders as a command. */
function classify(line: string): Line {
    const match = line.match(/^(\s*)([$#❯➜])\s+(.*)$/);
    if (match && PROMPTS.has(match[2])) {
        return { prompt: match[2], text: match[1] + match[3] };
    }
    return { text: line };
}

function renderLine({ prompt, text }: Line): string {
    if (prompt) {
        return `<span class="terminal__line" data-cmd="true" data-prompt="${escapeHtml(prompt)}">${escapeHtml(text)}</span>`;
    }
    return `<span class="terminal__line">${escapeHtml(text)}</span>`;
}

function renderTerminal(node: Code): string {
    const title = parseTitle(node.meta);
    const value = node.value
        .replace(/\r\n?/g, '\n')
        .replace(/^(?:[ \t]*\n)+/, '')
        .replace(/(?:\n[ \t]*)+$/, '');
    const lines = value.split('\n').map(classify);
    const firstPrompt = lines.find((l) => l.prompt)?.prompt;
    const body = lines.map(renderLine).join('');

    const titleHtml = title ? `<span class="terminal__title">${escapeHtml(title)}</span>` : '';
    const copyHtml = firstPrompt
        ? '<button class="terminal__copy" type="button">Copy</button>'
        : '';
    // A resting cursor on a fresh prompt line, echoing the session's first prompt
    // glyph. Output-only sessions (no prompt) get no trailing prompt.
    const cursorHtml = firstPrompt
        ? `<span class="terminal__line terminal__cursorline" data-prompt="${escapeHtml(firstPrompt)}" aria-hidden="true"><span class="terminal__cursor"></span></span>`
        : '';

    return [
        '<figure class="terminal">',
        '<header class="terminal__bar">',
        '<span class="terminal__tag">[ SHELL ]</span>',
        titleHtml,
        '<span class="terminal__rule" aria-hidden="true"></span>',
        copyHtml,
        '</header>',
        `<pre class="terminal__body" tabindex="0"><code class="terminal__code">${body}${cursorHtml}</code></pre>`,
        '</figure>',
    ].join('');
}

/**
 * Renders a ```terminal fenced block as a shell session: lines beginning with a
 * prompt glyph (`$`, `#`, `❯`, `➜`) are commands, everything else is output.
 * Runs before remark-code-shell so those fences aren't also turned into code
 * blocks. The Copy button (present only when there's a command) copies the
 * command lines, prompts excluded.
 */
export const remarkTerminal: Plugin<[], Root> = () => {
    return (tree) => {
        const nodes: Array<{ node: Code; parent: { children: unknown[] }; index: number }> = [];
        visit(tree, 'code', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return;
            if (!node.lang || !LANGS.has(node.lang.toLowerCase())) return;
            nodes.push({ node, parent: parent as { children: unknown[] }, index });
        });

        for (const { node, parent, index } of nodes) {
            const child: Html = { type: 'html', value: renderTerminal(node) };
            parent.children[index] = child;
        }
    };
};

export default remarkTerminal;

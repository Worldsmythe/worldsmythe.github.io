import type { Html, Root } from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

declare module 'mdast' {
    interface Data {
        hName?: string;
        hProperties?: Record<string, unknown>;
    }
}

const HINT = 'Generation uses the title above plus the current Story Card Command.';
const ENTRY_PLACEHOLDER =
    'The AI uses this for context whenever one of the trigger words below is used in the story.';
const SEPARATOR = /^[ \t]*-{3,}[ \t]*$/;
const FENCE_END = /^:::+[ \t]*$/;

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function trimBlankLines(value: string): string {
    return value.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
}

/**
 * Reads a container directive's body verbatim from the source, stripping the
 * opening `:::name{…}` and closing `:::` lines. Used so story-card content is
 * taken literally rather than parsed as markdown.
 */
function rawBody(directive: ContainerDirective, source: string): string {
    const start = directive.position?.start.offset;
    const end = directive.position?.end.offset;
    if (start === undefined || end === undefined) return '';
    const lines = source.slice(start, end).replace(/\r\n/g, '\n').split('\n');
    lines.shift();
    if (lines.length && FENCE_END.test(lines[lines.length - 1])) lines.pop();
    return lines.join('\n');
}

function field(label: string, inner: string): string {
    return `<div class="sc__field"><span class="sc__label">${label}</span>${inner}</div>`;
}

/**
 * Renders a `:::storycard{title type triggers}` container directive as a themed
 * mock of the AI Dungeon story-card editor. The body is taken literally: text
 * before a `---` line becomes the ENTRY field, text after it becomes NOTES.
 */
export const remarkStorycard: Plugin<[], Root> = () => {
    return (tree, file) => {
        const source = String(file.value);
        visit(tree, 'containerDirective', (directive: ContainerDirective) => {
            if (directive.name !== 'storycard') return;

            const attrs = directive.attributes ?? {};
            const title = attrs.title ?? '';
            const type = attrs.type ?? 'Class';
            const triggers = attrs.triggers ?? '';

            const body = rawBody(directive, source);
            const lines = body.split('\n');
            const sep = lines.findIndex((line) => SEPARATOR.test(line));
            const entry = trimBlankLines(sep === -1 ? body : lines.slice(0, sep).join('\n'));
            const notes = trimBlankLines(sep === -1 ? '' : lines.slice(sep + 1).join('\n'));

            const entryInner = entry
                ? escapeHtml(entry)
                : `<span class="sc__placeholder">${escapeHtml(ENTRY_PLACEHOLDER)}</span>`;
            const triggersInner = triggers
                ? escapeHtml(triggers)
                : '<span class="sc__placeholder">Enter a comma separated list triggers. This is how the AI will know</span>';
            const notesInner = notes
                ? `<pre class="sc__pre">${escapeHtml(notes)}</pre>`
                : '<span class="sc__placeholder">Notes for this story element. These are not visible to the AI but will be visible to players during character creation.</span>';

            const data = directive.data ?? (directive.data = {});
            data.hName = 'figure';
            data.hProperties = { className: ['storycard'] };

            const markup =
                '<header class="sc__bar" aria-hidden="true">' +
                '<span class="sc__menu">⋯</span>' +
                `<span class="sc__title">${escapeHtml(title)}</span>` +
                '<span class="sc__finish">Finish</span>' +
                '</header>' +
                '<div class="sc__tabs" aria-hidden="true">' +
                '<span class="sc__tab is-on">Details</span>' +
                '<span class="sc__tab">Command</span>' +
                '</div>' +
                field(
                    'Type',
                    `<div class="sc__select"><span>${escapeHtml(type)}</span>` +
                        '<span class="sc__chev" aria-hidden="true">▾</span></div>',
                ) +
                field(
                    'Name',
                    `<div class="sc__input">${escapeHtml(title)}</div>` +
                        `<p class="sc__hint">${escapeHtml(HINT)}</p>`,
                ) +
                field(
                    'Entry',
                    `<div class="sc__area sc__area--entry">${entryInner}</div>` +
                        '<div class="sc__foot" aria-hidden="true">' +
                        `<span class="sc__count">${entry.length} / 1000</span>` +
                        '<span class="sc__gen">✦ Generate Entry with AI</span></div>',
                ) +
                field('Triggers', `<div class="sc__input">${triggersInner}</div>`) +
                field('Notes', `<div class="sc__area sc__area--notes">${notesInner}</div>`);

            const child: Html = { type: 'html', value: markup };
            directive.children = [child];
        });
    };
};

export default remarkStorycard;

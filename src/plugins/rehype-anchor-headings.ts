import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const HEADING_LEVELS: Record<string, number> = {
    h2: 2,
    h3: 3,
    h4: 4,
    h5: 5,
    h6: 6,
};

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/['"`]/g, '')
        .replace(/[^a-z0-9\s-]/g, ' ')
        .trim()
        .replace(/\s+/g, '-');
}

function collectText(node: Element): string {
    let out = '';
    visit(node, 'text', (text) => {
        out += text.value;
    });
    return out;
}

export const rehypeAnchorHeadings: Plugin<[], Root> = () => {
    return (tree) => {
        const seen = new Map<string, number>();
        visit(tree, 'element', (node) => {
            const level = HEADING_LEVELS[node.tagName];
            if (!level) return;
            const text = collectText(node);
            if (!text) return;
            const base = slugify(text);
            if (!base) return;
            const count = seen.get(base) ?? 0;
            seen.set(base, count + 1);
            const slug = count === 0 ? base : `${base}-${count}`;

            node.properties ??= {};
            if (!node.properties.id) {
                node.properties.id = slug;
            }
            const id = String(node.properties.id);
            const marker = '#'.repeat(level);

            node.children.unshift({
                type: 'element',
                tagName: 'a',
                properties: {
                    href: `#${id}`,
                    className: ['heading-anchor'],
                    'aria-label': `Link to ${text}`,
                },
                children: [{ type: 'text', value: marker }],
            });
        });
    };
};

export default rehypeAnchorHeadings;

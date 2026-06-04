import type { Root, Element, ElementContent } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

function soleImage(node: Element): Element | null {
    const significant = node.children.filter(
        (child) => !(child.type === 'text' && /^\s*$/.test(child.value)),
    );
    if (
        significant.length === 1 &&
        significant[0].type === 'element' &&
        significant[0].tagName === 'img'
    ) {
        return significant[0];
    }
    return null;
}

export const rehypeFigure: Plugin<[], Root> = () => {
    return (tree) => {
        visit(tree, 'element', (node) => {
            // every markdown image is below-the-fold content (the hero is a
            // separate layout <Image>), so lazy-load and async-decode them all
            if (node.tagName === 'img') {
                node.properties = { loading: 'lazy', decoding: 'async', ...(node.properties ?? {}) };
                return;
            }
            if (node.tagName !== 'p') return;
            const img = soleImage(node);
            if (!img) return;

            const title = img.properties?.title;
            const caption = typeof title === 'string' && title.trim() ? title.trim() : null;
            if (img.properties) delete img.properties.title;

            node.tagName = 'figure';
            node.properties = { ...(node.properties ?? {}), className: ['figure'] };

            const children: ElementContent[] = [img];
            if (caption) {
                children.push({
                    type: 'element',
                    tagName: 'figcaption',
                    properties: { className: ['figure__cap'] },
                    children: [{ type: 'text', value: caption }],
                });
            }
            node.children = children;
        });
    };
};

export default rehypeFigure;

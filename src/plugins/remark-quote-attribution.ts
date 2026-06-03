import type { Blockquote, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

declare module 'mdast' {
    interface Data {
        hName?: string;
    }
}

const ATTRIBUTION = /^\s*(?:—|–|--)\s*/;

/**
 * Promotes a trailing dash line inside a blockquote into a `<cite>` so the
 * attribution picks up the cite styling. A blockquote whose last paragraph
 * starts with an em/en-dash (or `--`) becomes the citation; the dash itself is
 * dropped because the stylesheet re-adds it. Requires a separate quote
 * paragraph so an em-dash opening a quote isn't mistaken for attribution.
 */
export const remarkQuoteAttribution: Plugin<[], Root> = () => {
    return (tree) => {
        visit(tree, 'blockquote', (node: Blockquote) => {
            if (node.children.length < 2) return;
            const last = node.children[node.children.length - 1];
            if (last.type !== 'paragraph') return;
            const lead = last.children[0];
            if (!lead || lead.type !== 'text' || !ATTRIBUTION.test(lead.value)) return;

            lead.value = lead.value.replace(ATTRIBUTION, '');
            if (lead.value === '') last.children.shift();

            last.data = { ...last.data, hName: 'cite' };
        });
    };
};

export default remarkQuoteAttribution;

import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

interface AdmonitionVariant {
    key: string;
    label: string;
}

const VARIANTS: Record<string, AdmonitionVariant> = {
    note: { key: 'note', label: 'NOTE' },
    info: { key: 'note', label: 'INFO' },
    tip: { key: 'tip', label: 'TIP' },
    hint: { key: 'tip', label: 'HINT' },
    warn: { key: 'warn', label: '▲ WARN' },
    warning: { key: 'warn', label: '▲ WARN' },
    caution: { key: 'warn', label: '▲ CAUTION' },
    danger: { key: 'danger', label: '!! ERROR' },
    error: { key: 'danger', label: '!! ERROR' },
    system: { key: 'system', label: 'SYSTEM' },
    transmit: { key: 'transmit', label: 'TRANSMIT' },
    tx: { key: 'transmit', label: 'TRANSMIT' },
};

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function collectText(node: { children?: Array<{ type: string; value?: string; children?: unknown }> }): string {
    let out = '';
    visit(node as Parameters<typeof visit>[0], 'text', (text) => {
        if (typeof text.value === 'string') out += text.value;
    });
    return out;
}

export const remarkAdmonitions: Plugin<[], Root> = () => {
    return (tree) => {
        visit(tree, (node) => {
            if (node.type !== 'containerDirective') return;
            const directive = node as typeof node & {
                name: string;
                children: Array<{ data?: { directiveLabel?: boolean } }>;
            };
            const variant = VARIANTS[directive.name];
            if (!variant) return;

            const labelNode = directive.children.find((child) => child.data?.directiveLabel);
            const labelText = labelNode ? collectText(labelNode as Parameters<typeof collectText>[0]) : '';
            const bodyChildren = directive.children.filter((child) => !child.data?.directiveLabel);

            const data = (directive as { data?: Record<string, unknown> }).data ?? {};
            data.hName = 'aside';
            data.hProperties = {
                className: ['admonition', `admonition--${variant.key}`],
                'data-variant': variant.key,
            };
            (directive as { data?: Record<string, unknown> }).data = data;

            const titleHtml = labelText
                ? `<span class="admonition__title">${escapeHtml(labelText)}</span>`
                : '';

            const headerHtml =
                '<header class="admonition__bar" aria-hidden="true">' +
                `<span class="admonition__tag">[ ${escapeHtml(variant.label)} ]</span>` +
                titleHtml +
                '</header>';

            directive.children = [
                { type: 'html', value: headerHtml },
                { type: 'html', value: '<div class="admonition__body">' },
                ...bodyChildren,
                { type: 'html', value: '</div>' },
            ] as typeof directive.children;
        });
    };
};

export default remarkAdmonitions;

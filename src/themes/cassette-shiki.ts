import type { ThemeRegistration } from 'shiki';

export const cassetteShiki: ThemeRegistration = {
    name: 'cassette',
    type: 'dark',
    colors: {
        'editor.background': 'transparent',
        'editor.foreground': 'var(--ink)',
    },
    tokenColors: [
        {
            scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
            settings: { foreground: 'var(--ink-mut)', fontStyle: 'italic' },
        },
        {
            scope: ['string', 'string.quoted', 'constant.character', 'constant.other.symbol'],
            settings: { foreground: 'var(--lime)' },
        },
        {
            scope: ['constant.numeric', 'constant.language', 'support.constant'],
            settings: { foreground: 'var(--lime)' },
        },
        {
            scope: [
                'keyword',
                'keyword.control',
                'keyword.operator.new',
                'storage',
                'storage.type',
                'storage.modifier',
            ],
            settings: { foreground: 'var(--amber)', fontStyle: 'bold' },
        },
        {
            scope: ['entity.name.function', 'support.function', 'meta.function-call'],
            settings: { foreground: 'var(--amber)' },
        },
        {
            scope: [
                'entity.name.type',
                'entity.name.class',
                'entity.other.inherited-class',
                'support.class',
                'support.type',
            ],
            settings: { foreground: 'var(--ink)' },
        },
        {
            scope: ['variable', 'variable.other', 'support.variable'],
            settings: { foreground: 'var(--ink)' },
        },
        {
            scope: ['variable.language', 'variable.parameter'],
            settings: { foreground: 'var(--ink-dim)' },
        },
        {
            scope: [
                'punctuation',
                'meta.brace',
                'meta.delimiter',
                'keyword.operator',
                'punctuation.separator',
            ],
            settings: { foreground: 'var(--ink-dim)' },
        },
        {
            scope: ['entity.other.attribute-name', 'meta.tag.attribute'],
            settings: { foreground: 'var(--lime)' },
        },
        {
            scope: ['entity.name.tag', 'meta.tag'],
            settings: { foreground: 'var(--amber)' },
        },
        {
            scope: ['markup.heading', 'markup.bold'],
            settings: { foreground: 'var(--amber)', fontStyle: 'bold' },
        },
        {
            scope: ['markup.italic'],
            settings: { fontStyle: 'italic' },
        },
        {
            scope: ['markup.inserted'],
            settings: { foreground: 'var(--lime)' },
        },
        {
            scope: ['markup.deleted'],
            settings: { foreground: 'var(--signal)' },
        },
    ],
};

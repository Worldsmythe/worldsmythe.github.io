// @ts-check

import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import remarkDirective from 'remark-directive';

import { remarkAdmonitions } from './src/plugins/remark-admonitions.ts';
import { remarkCodeShell } from './src/plugins/remark-code-shell.ts';
import { remarkQuoteAttribution } from './src/plugins/remark-quote-attribution.ts';
import { rehypeAnchorHeadings } from './src/plugins/rehype-anchor-headings.ts';
import { rehypeFigure } from './src/plugins/rehype-figure.ts';

// https://astro.build/config
export default defineConfig({
    site: 'https://worldsmythe.github.io',
    integrations: [mdx(), sitemap()],
    markdown: {
        syntaxHighlight: false,
        processor: unified({
            remarkPlugins: [remarkDirective, remarkAdmonitions, remarkCodeShell, remarkQuoteAttribution],
            rehypePlugins: [rehypeAnchorHeadings, rehypeFigure],
        }),
    },
    fonts: [
        {
            provider: fontProviders.google(),
            name: 'IBM Plex Serif',
            cssVariable: '--font-serif',
            fallbacks: ['Georgia', 'Times New Roman', 'serif'],
            weights: [400, 600],
            styles: ['normal', 'italic'],
            subsets: ['latin'],
        },
        {
            provider: fontProviders.google(),
            name: 'IBM Plex Mono',
            cssVariable: '--font-mono',
            fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            weights: [400, 500, 600, 700],
            styles: ['normal', 'italic'],
            subsets: ['latin'],
        },
    ],
});

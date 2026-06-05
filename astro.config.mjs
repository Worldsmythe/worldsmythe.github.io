// @ts-check

import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import remarkDirective from 'remark-directive';
import { remarkCodeShell } from '@worldsmythe/code-shell';

import { remarkAdmonitions } from './src/plugins/remark-admonitions.ts';
import { remarkQuoteAttribution } from './src/plugins/remark-quote-attribution.ts';
import { remarkStorycard } from './src/plugins/remark-storycard.ts';
import { remarkTerminal } from './src/plugins/remark-terminal.ts';
import { remarkTrace } from './src/plugins/remark-trace.ts';
import { rehypeAnchorHeadings } from './src/plugins/rehype-anchor-headings.ts';
import { rehypeFigure } from './src/plugins/rehype-figure.ts';

// https://astro.build/config
export default defineConfig({
    site: 'https://worldsmythe.github.io',
    integrations: [mdx(), sitemap()],
    build: { inlineStylesheets: 'always' },
    markdown: {
        syntaxHighlight: false,
        processor: unified({
            remarkPlugins: [
                remarkDirective,
                remarkAdmonitions,
                remarkStorycard,
                remarkTrace,
                remarkTerminal,
                remarkCodeShell,
                remarkQuoteAttribution,
            ],
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

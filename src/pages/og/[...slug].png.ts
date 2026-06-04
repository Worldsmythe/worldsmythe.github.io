import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ogChromeHtml } from '../../lib/og/card';
import { renderOgCard } from '../../lib/og/render';

export const prerender = true;

interface OgProps {
    title: string;
    description: string;
    stamp: string;
    heroPath?: string;
}

const stampOf = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '.');

function heroPathFor(filePath: string | undefined): string | undefined {
    if (!filePath) return undefined;
    const postPath = resolve(process.cwd(), filePath);
    let source: string;
    try {
        source = readFileSync(postPath, 'utf8');
    } catch {
        return undefined;
    }
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const hero = frontmatter?.[1].match(/^heroImage:\s*['"]?(.+?)['"]?\s*$/m);
    if (!hero) return undefined;
    return resolve(dirname(postPath), hero[1]);
}

export async function getStaticPaths() {
    const posts = await getCollection('blog');
    return posts.map((post) => ({
        params: { slug: post.id },
        props: {
            title: post.data.title,
            description: post.data.description,
            stamp: stampOf(post.data.pubDate),
            heroPath: heroPathFor(post.filePath),
        } satisfies OgProps,
    }));
}

export const GET: APIRoute<OgProps> = async ({ props }) => {
    const { title, description, stamp, heroPath } = props;
    const png = await renderOgCard({ markup: ogChromeHtml({ title, description, stamp }), heroPath });
    return new Response(png, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
};

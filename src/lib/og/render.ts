import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const fontDir = join(process.cwd(), 'src', 'assets', 'og', 'fonts');
const fontFile = (name: string) => readFileSync(join(fontDir, name));

const fonts = [
    { name: 'IBM Plex Mono', data: fontFile('IBMPlexMono-Regular.woff'), weight: 400, style: 'normal' },
    { name: 'IBM Plex Mono', data: fontFile('IBMPlexMono-Bold.woff'), weight: 700, style: 'normal' },
    { name: 'IBM Plex Serif', data: fontFile('IBMPlexSerif-Italic.woff'), weight: 400, style: 'italic' },
] satisfies NonNullable<Parameters<typeof satori>[1]>['fonts'];

const fallbackBackground = join(process.cwd(), 'src', 'assets', 'fallback.png');

interface RenderOptions {
    markup: Parameters<typeof satori>[0];
    heroPath?: string;
}

/**
 * Renders a post's OG card to a 1200x630 PNG: satori draws the chrome, sharp
 * composites it over the cover-cropped hero image (or the site fallback).
 */
export async function renderOgCard({ markup, heroPath }: RenderOptions): Promise<Buffer> {
    const svg = await satori(markup, { width: 1200, height: 630, fonts });
    return sharp(heroPath ?? fallbackBackground)
        .resize(1200, 630, { fit: 'cover' })
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

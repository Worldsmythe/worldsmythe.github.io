import { LANGUAGES } from './languages.data';

export interface LanguageInfo {
    name: string;
    color: string;
}

const DEFAULT_COLOR = 'var(--amber)';
const VISIBLE_FLOOR = 0.4;

function titleCase(lang: string): string {
    return lang ? lang.charAt(0).toUpperCase() + lang.slice(1) : 'Text';
}

/** Lightens colors too dark to read on the dark theme background toward white. */
function ensureVisible(hex: string): string {
    const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
    if (!match) return hex;
    let r = parseInt(match[1].slice(0, 2), 16);
    let g = parseInt(match[1].slice(2, 4), 16);
    let b = parseInt(match[1].slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance >= VISIBLE_FLOOR) return hex;
    const t = (VISIBLE_FLOOR - luminance) / (1 - luminance);
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves a fence language (any Linguist alias or name) to a canonical display
 * name and a theme-legible color, so `ts` and `typescript` both yield
 * `{ TypeScript, #3178c6 }`. Unknown languages fall back to the theme accent.
 */
export function resolveLanguage(lang: string | null | undefined): LanguageInfo {
    if (!lang) return { name: 'Text', color: DEFAULT_COLOR };
    const data = LANGUAGES[lang.toLowerCase()];
    if (!data) return { name: titleCase(lang), color: DEFAULT_COLOR };
    return { name: data.name, color: ensureVisible(data.color) };
}

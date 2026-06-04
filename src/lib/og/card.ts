const INK = '#e9e2c8';
const INK_DIM = '#9bab8f';
const INK_MUT = '#6f7e69';
const LIME = '#98e04a';
const DARK = '#08160e';
const SCRIM = 'rgba(10, 28, 19, 0.68)';
const TEXT_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.7)';

interface OgCardData {
    title: string;
    description: string;
    stamp: string;
}

type Style = Record<string, string | number>;

interface VNode {
    type: string;
    props: { style: Style; children?: VNode[] | string };
}

function rect(style: Style): VNode {
    return { type: 'div', props: { style } };
}

function text(style: Style, value: string): VNode {
    return { type: 'div', props: { style, children: value } };
}

function box(style: Style, children: VNode[]): VNode {
    return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

function bracket(left: number, top: number, width: number, height: number): VNode {
    return rect({ position: 'absolute', left, top, width, height, backgroundColor: INK });
}

function crtOverlay(): VNode[] {
    return [
        rect({
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage:
                'radial-gradient(120% 90% at 50% -10%, rgba(152, 224, 74, 0.05), transparent 60%), radial-gradient(120% 120% at 50% 120%, rgba(0, 0, 0, 0.5), transparent 70%)',
        }),
        rect({
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            opacity: 0.55,
            backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0, 0, 0, 0.16) 2px, rgba(0, 0, 0, 0.16) 3px)',
        }),
    ];
}

/**
 * Builds the satori vnode for a post's OpenGraph card chrome. The background is
 * transparent so renderOgCard can composite it over the hero image.
 */
export function ogChromeHtml({ title, description, stamp }: OgCardData): VNode {
    const dek =
        description.length > 150 ? `${description.slice(0, 147).trimEnd()}...` : description;

    return box({ position: 'relative', width: 1200, height: 630, fontFamily: 'IBM Plex Mono' }, [
        rect({ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, backgroundColor: SCRIM }),
        bracket(80, 80, 1040, 6),
        bracket(80, 80, 6, 80),
        bracket(1114, 80, 6, 80),
        bracket(80, 544, 1040, 6),
        bracket(80, 470, 6, 80),
        bracket(1114, 470, 6, 80),
        box(
            {
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'absolute',
                left: 120,
                top: 128,
                width: 960,
                height: 374,
            },
            [
                box({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, [
                    text(
                        { fontSize: 26, fontWeight: 700, letterSpacing: 6, color: INK, textShadow: TEXT_SHADOW },
                        'WORLDSMYTHE',
                    ),
                    box({ flexDirection: 'row', alignItems: 'center' }, [
                        text(
                            {
                                backgroundColor: LIME,
                                color: DARK,
                                fontSize: 18,
                                fontWeight: 700,
                                letterSpacing: 2,
                                padding: '6px 12px',
                            },
                            'SIGNAL',
                        ),
                        text(
                            { fontSize: 22, color: INK_DIM, marginLeft: 18, textShadow: TEXT_SHADOW },
                            stamp,
                        ),
                    ]),
                ]),
                box({ flexDirection: 'column' }, [
                    text(
                        {
                            fontSize: 62,
                            fontWeight: 700,
                            letterSpacing: -1,
                            lineHeight: 1.05,
                            color: INK,
                            textShadow: `${TEXT_SHADOW}, 0 0 28px rgba(152, 224, 74, 0.45)`,
                        },
                        title.toUpperCase(),
                    ),
                    text(
                        {
                            fontFamily: 'IBM Plex Serif',
                            fontStyle: 'italic',
                            fontSize: 24,
                            lineHeight: 1.35,
                            color: INK_DIM,
                            marginTop: 22,
                            textShadow: TEXT_SHADOW,
                        },
                        dek,
                    ),
                ]),
                text(
                    { fontSize: 20, letterSpacing: 3, color: INK_MUT, textShadow: TEXT_SHADOW },
                    '// NODE 01',
                ),
            ],
        ),
        ...crtOverlay(),
    ]);
}

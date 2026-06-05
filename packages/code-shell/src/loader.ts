import { existsSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar, { type FSWatcher } from 'chokidar';
import { glob } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';

type GlobOptions = Parameters<typeof glob>[0];

// One watcher per process. Across dev restarts the loader re-runs with a fresh
// Vite server; we close the previous watcher so stale ones don't accumulate and
// race on the shared data-store.json.
let activeWatcher: FSWatcher | null = null;
let activeServer: unknown = null;

function baseDirOf(root: string, base: GlobOptions['base']): string {
    if (base instanceof URL) return fileURLToPath(base);
    return resolve(root, base ?? '.');
}

/** Maps a snippet path back to its post by the per-post layout convention: a file
 * under `<base>/<slug>/...` belongs to `<base>/<slug>.md`. */
function postFor(baseDir: string, abs: string): string | null {
    const rel = relative(baseDir, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) return null;
    const slug = rel.split(sep)[0];
    if (!slug) return null;
    const post = resolve(baseDir, `${slug}.md`);
    return existsSync(post) ? post : null;
}

/**
 * Wraps Astro's `glob()` loader so that, in dev, editing a code-block snippet file
 * re-renders the post that reads it. Snippets are read with `fs` inside the remark
 * plugin, so a snippet edit leaves the post's markdown bytes — and its content-layer
 * digest — unchanged, and the cached render would be reused.
 *
 * On a snippet change we poison the owning post's stored digest and re-emit a content
 * change: glob then re-renders the post through the real markdown pipeline (the
 * `renderMarkdown` context helper ignores a custom `markdown.processor`, so it can't
 * be used here). Poisoning rather than deleting keeps the entry present, so the route
 * never 404s mid-render. The resulting `.astro/data-store.json` write is bridged back
 * to Vite's watcher — which Vite ignores because it lives under `.astro` — so Astro's
 * own `invalidateDataStore` fires and reloads the page. Only writes our re-render
 * caused are bridged: bridging Astro's own writes (initial sync, restarts) would
 * re-import a half-built store and empty the collection. Build is unaffected: with no
 * dev watcher this is exactly `glob()`.
 */
export function codeShellGlob(options: GlobOptions): Loader {
    const inner = glob(options);
    return {
        ...inner,
        load: async (context: LoaderContext) => {
            await inner.load(context);
            const vite = context.watcher;
            if (!vite || vite === activeServer) return;

            if (activeWatcher) void activeWatcher.close();
            activeServer = vite;

            const root = fileURLToPath(context.config.root);
            const baseDir = baseDirOf(root, options.base);
            const storePath = resolve(root, '.astro', 'data-store.json');
            const norm = (p: string) => resolve(p).replace(/\\/g, '/').toLowerCase();
            const storeKey = norm(storePath);
            let pendingReload = false;

            const reRender = (abs: string) => {
                if (/\.mdx?$/.test(abs)) return;
                const post = postFor(baseDir, abs);
                if (!post) return;
                const rel = relative(root, post).split(sep).join('/').toLowerCase();
                const entry = context.store
                    .values()
                    .find((e) => typeof e.filePath === 'string' && e.filePath.toLowerCase() === rel);
                if (!entry || entry.digest?.startsWith('code-shell-stale:')) return;
                context.store.set({ ...entry, digest: `code-shell-stale:${entry.digest ?? ''}` });
                context.logger.info(`snippet changed (${basename(abs)}) → re-rendering ${basename(post)}`);
                pendingReload = true;
                vite.emit('change', post);
            };

            try {
                const watcher = chokidar.watch([baseDir, storePath], { ignoreInitial: true });
                activeWatcher = watcher;
                watcher.on('all', (_event, changed) => {
                    const abs = isAbsolute(changed) ? changed : resolve(root, changed);
                    if (norm(abs) === storeKey) {
                        if (pendingReload) {
                            pendingReload = false;
                            vite.emit('change', storePath);
                        }
                    } else {
                        reRender(abs);
                    }
                });
            } catch (error) {
                context.logger.warn(`code-shell dev watch disabled: ${String(error)}`);
            }
        },
    };
}

import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const THEME_BOOT_SCRIPT = path.resolve(import.meta.dirname, '../src/themeBoot.js');

function buildThemeBoot() {
  const source = fs.readFileSync(THEME_BOOT_SCRIPT, 'utf8');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);

  return { source, fileName: `assets/theme-boot.${hash}.js` };
}

/**
 * Emits `src/themeBoot.js` as a content-hashed classic script and loads it blocking at the top of <head>, so the
 * color scheme and theme variant attributes exist before first paint. The index CSP forbids inline scripts.
 */
export function themeBoot(): Plugin {
  return {
    name: 'calagopus:theme-boot',

    configureServer(server) {
      server.watcher.add(THEME_BOOT_SCRIPT);
      server.middlewares.use((req, res, next) => {
        const { source, fileName } = buildThemeBoot();
        if (req.url !== `/${fileName}`) return next();

        res.setHeader('Content-Type', 'text/javascript');
        res.end(source);
      });
    },

    generateBundle() {
      const { source, fileName } = buildThemeBoot();
      this.emitFile({ type: 'asset', fileName, source });
    },

    transformIndexHtml() {
      return [{ tag: 'script', attrs: { src: `/${buildThemeBoot().fileName}` }, injectTo: 'head-prepend' }];
    },
  };
}

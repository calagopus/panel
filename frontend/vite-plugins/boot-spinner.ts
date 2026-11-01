import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { listExtensionIdentifiers } from './extension-overrides.ts';

const SPINNER_CSS = path.resolve(import.meta.dirname, '../src/elements/feedback/spinner.css');
const EXTENSIONS_DIR = path.resolve(import.meta.dirname, '../extensions');

const DEFAULT_SPINNER =
  '<div style="display:flex;align-items:center;justify-content:center;padding:1.5rem 0"><span class="spinner" aria-label="Loading Spinner"></span></div>';

function rawTemplate(content: string): string {
  if (content.includes('endraw')) {
    throw new Error('[boot-spinner] boot markup must not contain "endraw"');
  }

  return `{% raw %}${content}{% endraw %}`;
}

function extensionBootMarkup(): [identifier: string, markup: string] | null {
  const providers = listExtensionIdentifiers().filter((identifier) =>
    fs.existsSync(path.join(EXTENSIONS_DIR, identifier, 'src', 'boot.html')),
  );

  if (providers.length > 1) {
    throw new Error(
      `[boot-spinner] multiple extensions provide src/boot.html (${providers.join(', ')}), only one may replace the boot spinner`,
    );
  }

  if (providers.length === 0) return null;

  return [providers[0], fs.readFileSync(path.join(EXTENSIONS_DIR, providers[0], 'src', 'boot.html'), 'utf8').trim()];
}

export function bootSpinner(): Plugin {
  let isBuild = false;

  return {
    name: 'boot-spinner',

    configResolved(config) {
      isBuild = config.command === 'build';
    },

    configureServer(server) {
      server.watcher.add(path.join(EXTENSIONS_DIR, '*/src/boot.html'));
      server.watcher.on('all', (_event, file) => {
        if (file.endsWith(`${path.sep}src${path.sep}boot.html`) && file.includes(`${path.sep}extensions${path.sep}`)) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },

    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const css = fs.readFileSync(SPINNER_CSS, 'utf8');
        const extension = extensionBootMarkup();

        let markup = extension ? extension[1] : DEFAULT_SPINNER;
        if (isBuild) {
          markup = extension
            ? `{% if "${extension[0]}" not in inactive_extensions %}${rawTemplate(extension[1])}{% else %}${DEFAULT_SPINNER}{% endif %}`
            : DEFAULT_SPINNER;

          html = html
            .replace(
              /(<link rel="stylesheet"[^>]*? href="\/assets\/extension-([a-z0-9_]+)\.[^"/]+\.css")/g,
              '$1{% if "$2" in inactive_extensions %} disabled{% endif %}',
            )
            .replace(
              '</head>',
              `<meta name="inactive-extensions" content="{{ inactive_extensions|join(',') }}"/></head>`,
            );
        }

        return {
          html: html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`),
          tags: [
            {
              tag: 'style',
              children: `:where(html){background-color:var(--mantine-color-body,#242424)}\n${css}`,
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}

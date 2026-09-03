import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { DEPRECATED_PATHS } from './deprecated-paths.generated.ts';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

function toSrcRelative(id: string): string {
  return path.relative(srcDir, id.split('?')[0]).split(path.sep).join('/');
}

export function deprecatedPaths(): Plugin {
  const warned = new Set<string>();

  return {
    name: 'calagopus:deprecated-paths',
    enforce: 'pre',

    load(id) {
      const rel = toSrcRelative(id);
      const replacement = DEPRECATED_PATHS[rel];

      if (replacement && !warned.has(rel)) {
        warned.add(rel);
        this.warn(
          `"@/${rel}" is a deprecated path and will be removed in a future release. ` +
            `Import from "@/${replacement}" instead.`,
        );
      }

      return null;
    },
  };
}

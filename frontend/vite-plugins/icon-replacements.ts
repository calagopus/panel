import type { Plugin } from 'vite';
import path from 'node:path';

const FONTAWESOME_REACT = '@fortawesome/react-fontawesome';
const ICON_MODULE = path.resolve(import.meta.dirname, '..', 'src', 'elements', 'data-display', 'Icon.tsx');

/**
 * Routes every `@fortawesome/react-fontawesome` import, core and extension, through `Icon.tsx` so its
 * `FontAwesomeIcon` can apply icon replacements. `Icon.tsx` itself still gets the real package.
 */
export function iconReplacements(): Plugin {
  return {
    name: 'calagopus:icon-replacements',
    enforce: 'pre',

    resolveId(source, importer) {
      if (source !== FONTAWESOME_REACT || !importer) return;
      if (path.resolve(importer.split('?')[0]) === ICON_MODULE) return;

      return ICON_MODULE;
    },
  };
}

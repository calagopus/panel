import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadIconPackage } from './fontawesome-icons.ts';

const VIRTUAL_ID = 'virtual:icon-manifest';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const FONTAWESOME_SETS = [
  ['solid', '@fortawesome/free-solid-svg-icons'],
  ['regular', '@fortawesome/free-regular-svg-icons'],
  ['brands', '@fortawesome/free-brands-svg-icons'],
] as const;

type IconManifestEntry = [width: number, height: number, path: string, aliases: string[]];

async function buildIconManifest() {
  const icons: Record<string, IconManifestEntry> = {};

  for (const [set, packageName] of FONTAWESOME_SETS) {
    const pkg = await loadIconPackage(fileURLToPath(import.meta.resolve(packageName)));

    for (const definition of pkg.icons.values()) {
      if (!Array.isArray(definition.icon)) continue;

      const [width, height, aliases, , path] = definition.icon;

      icons[`fontawesome:${set}:${definition.iconName}`] = [
        width,
        height,
        Array.isArray(path) ? path.join(' ') : path,
        aliases.filter((alias): alias is string => typeof alias === 'string'),
      ];
    }
  }

  const source = JSON.stringify(Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b))));
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);

  return { source, fileName: `assets/icons/fontawesome.${hash}.json` };
}

/**
 * Emits every FontAwesome icon as one content-hashed JSON manifest. The backend resolves configured
 * icon identifiers (`fontawesome:<set>:<name>`) against it, and the admin icon picker fetches it on demand.
 */
export function iconManifest(): Plugin {
  let manifest: ReturnType<typeof buildIconManifest> | null = null;
  const getManifest = () => (manifest ??= buildIconManifest());

  return {
    name: 'calagopus:icon-manifest',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { source, fileName } = await getManifest();
        if (req.url !== `/${fileName}`) return next();

        res.setHeader('Content-Type', 'application/json');
        res.end(source);
      });
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return;

      const { fileName } = await getManifest();
      return `export const iconManifestUrl = ${JSON.stringify(`/${fileName}`)};`;
    },

    async generateBundle() {
      const { source, fileName } = await getManifest();
      this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

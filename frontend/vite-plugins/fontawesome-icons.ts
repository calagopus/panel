import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Plugin } from 'vite';
import { pathToFileURL } from 'node:url';

const VIRTUAL_PREFIX = '\0fontawesome-icon:';
const IMPORT_REGEX = /import\s*\{([^}]*)\}\s*from\s*(['"])(@fortawesome\/free-(?:solid|brands)-svg-icons)\2;?/g;

type IconPackage = {
  canonical: Map<string, string>;
  icons: Map<string, IconDefinition>;
};

export async function loadIconPackage(entry: string): Promise<IconPackage> {
  const module: Record<string, unknown> = await import(pathToFileURL(entry).href);
  const canonical = new Map<string, string>();
  const icons = new Map<string, IconDefinition>();
  const byIcon = new Map<unknown, string>();

  for (const [exportName, value] of Object.entries(module)) {
    if (!exportName.startsWith('fa') || typeof value !== 'object' || value === null) continue;

    const existing = byIcon.get(value);
    if (existing) {
      canonical.set(exportName, existing);
    } else {
      byIcon.set(value, exportName);
      canonical.set(exportName, exportName);
      icons.set(exportName, value as IconDefinition);
    }
  }

  return { canonical, icons };
}

export function fontAwesomeIcons(): Plugin {
  const packages = new Map<string, Promise<IconPackage>>();
  const getPackage = (name: string, resolve: (id: string) => Promise<{ id: string } | null>) => {
    let pkg = packages.get(name);
    if (!pkg) {
      pkg = resolve(name).then((resolved) => {
        if (!resolved) throw new Error(`Unable to resolve ${name}`);
        return loadIconPackage(resolved.id);
      });
      packages.set(name, pkg);
    }

    return pkg;
  };

  return {
    name: 'calagopus:fontawesome-icons',
    apply: 'build',

    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return id;
    },

    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return;

      const [pkgName, iconName] = id.slice(VIRTUAL_PREFIX.length).split('#');
      const icon = (await getPackage(pkgName, (name) => this.resolve(name))).icons.get(iconName);
      if (!icon) return;

      return `export const ${iconName} = ${JSON.stringify(icon)};`;
    },

    async transform(code, id) {
      if (id.includes('/node_modules/') || !code.includes('@fortawesome/free-')) return;

      const matches = [...code.matchAll(IMPORT_REGEX)];
      if (matches.length === 0) return;

      let result = '';
      let lastIndex = 0;

      for (const match of matches) {
        const [statement, specifiers, , pkgName] = match;
        const pkg = await getPackage(pkgName, (name) => this.resolve(name, id));
        const rewritten: string[] = [];
        const remaining: string[] = [];

        for (const raw of specifiers.split(',')) {
          const specifier = raw.trim();
          if (!specifier || specifier.startsWith('type ')) continue;

          const [imported, local = imported] = specifier.split(/\s+as\s+/);
          const canonical = pkg.canonical.get(imported);
          if (canonical) {
            rewritten.push(`import { ${canonical} as ${local} } from '${VIRTUAL_PREFIX}${pkgName}#${canonical}';`);
          } else {
            remaining.push(specifier);
          }
        }

        if (remaining.length > 0) {
          rewritten.push(`import { ${remaining.join(', ')} } from '${pkgName}';`);
        }

        result +=
          code.slice(lastIndex, match.index) + rewritten.join(' ') + '\n'.repeat(statement.split('\n').length - 1);
        lastIndex = match.index + statement.length;
      }

      return { code: result + code.slice(lastIndex), map: null };
    },
  };
}

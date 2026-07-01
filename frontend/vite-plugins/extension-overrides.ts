import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { parseSync } from 'vite';

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = path.join(FRONTEND_ROOT, 'src');
const EXTENSIONS_DIR = path.join(FRONTEND_ROOT, 'extensions');
const BACKEND_EXTENSIONS_DIR = path.resolve(FRONTEND_ROOT, '..', 'backend-extensions');

type AstNode = { type: string } & Record<string, unknown>;

interface OverrideDeclaration {
  original: string;
  replacement: string;
}

interface OverrideTarget {
  replacementReal: string;
  owner: string;
}

function realpathOrSelf(file: string): string {
  try {
    return fs.realpathSync(file);
  } catch {
    return file;
  }
}

function stripExt(file: string): string {
  const ext = path.extname(file);
  return ext ? file.slice(0, -ext.length) : file;
}

function resolveSpecifier(specifier: string, fromDir: string): string | null {
  if (specifier.startsWith('@/')) {
    return path.join(CORE_SRC, specifier.slice(2));
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.resolve(fromDir, specifier);
  }
  return null;
}

function listExtensionIdentifiers(): string[] {
  if (!fs.existsSync(EXTENSIONS_DIR)) return [];
  return fs.readdirSync(EXTENSIONS_DIR).filter((identifier) => identifier !== 'shared');
}

function readOverrideEntries(file: string): OverrideDeclaration[] {
  const source = fs.readFileSync(file, 'utf-8');
  const { program } = parseSync(file, source);

  const importSpecifiers = new Map<string, string>();
  for (const node of program.body as unknown as AstNode[]) {
    if (node.type !== 'ImportDeclaration') continue;

    const importSource = (node.source as { value: string }).value;
    for (const specifier of node.specifiers as AstNode[]) {
      if (specifier.type === 'ImportDefaultSpecifier' || specifier.type === 'ImportSpecifier') {
        importSpecifiers.set((specifier.local as { name: string }).name, importSource);
      }
    }
  }

  const entries: OverrideDeclaration[] = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const candidate = node as AstNode;

    if (candidate.type === 'CallExpression') {
      const callee = candidate.callee as AstNode;
      const args = candidate.arguments as AstNode[];

      if (callee.type === 'Identifier' && callee.name === 'defineOverride' && args.length === 2) {
        const [a, b] = args;
        if (a.type === 'Identifier' && b.type === 'Identifier') {
          const original = importSpecifiers.get(a.name as string);
          const replacement = importSpecifiers.get(b.name as string);
          if (original && replacement) {
            entries.push({ original, replacement });
          }
        }
      }
    }

    for (const value of Object.values(candidate)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };

  visit(program);

  return entries;
}

function buildOverrideMap(reportError: (message: string) => void): Map<string, OverrideTarget> {
  const map = new Map<string, OverrideTarget>();

  for (const identifier of listExtensionIdentifiers()) {
    const overridesPath = path.join(EXTENSIONS_DIR, identifier, 'src', 'overrides.ts');
    if (!fs.existsSync(overridesPath)) continue;

    let entries: OverrideDeclaration[];
    try {
      entries = readOverrideEntries(overridesPath);
    } catch (err) {
      reportError(
        `Failed to parse ${path.relative(FRONTEND_ROOT, overridesPath)}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const fromDir = path.dirname(overridesPath);

    for (const entry of entries) {
      const originalAbs = resolveSpecifier(entry.original, fromDir);
      const replacementAbs = resolveSpecifier(entry.replacement, fromDir);
      if (!originalAbs || !replacementAbs) continue;

      const key = stripExt(realpathOrSelf(originalAbs));
      const replacementReal = realpathOrSelf(replacementAbs);

      const existing = map.get(key);
      if (existing && existing.replacementReal !== replacementReal) {
        reportError(
          `Duplicate override: both "${existing.owner}" and "${identifier}" override ` +
            `"${path.relative(CORE_SRC, key)}". Only one extension may override a given core component.`,
        );
        continue;
      }

      map.set(key, { replacementReal, owner: identifier });
    }
  }

  return map;
}

export function extensionOverrides(): Plugin {
  let map = new Map<string, OverrideTarget>();

  return {
    name: 'extension-overrides',
    enforce: 'pre',

    config() {
      return {
        server: {
          fs: {
            allow: [FRONTEND_ROOT, BACKEND_EXTENSIONS_DIR],
          },
        },
      };
    },

    buildStart() {
      map = buildOverrideMap((message) => this.error(`[extension-overrides] ${message}`));
    },
    resolveId: {
      filter: { id: /^(@\/|\.{1,2}\/)/ },
      handler(source, importer, options) {
        if (map.size === 0 || !importer) return null;

        const abs = resolveSpecifier(source, path.dirname(importer));
        if (!abs) return null;

        const hit = map.get(stripExt(realpathOrSelf(abs)));
        if (!hit) return null;

        if (realpathOrSelf(importer) === hit.replacementReal) return null;

        return this.resolve(hit.replacementReal, importer, { ...options, skipSelf: true });
      },
    },

    configureServer(server) {
      for (const identifier of listExtensionIdentifiers()) {
        const overridesPath = path.join(EXTENSIONS_DIR, identifier, 'src', 'overrides.ts');
        if (fs.existsSync(overridesPath)) {
          server.watcher.add(realpathOrSelf(overridesPath));
        }
      }

      const handleOverridesChange = (file: string) => {
        const real = realpathOrSelf(file);
        if (path.basename(real) !== 'overrides.ts') return;
        if (!real.startsWith(`${BACKEND_EXTENSIONS_DIR}${path.sep}`)) return;

        server.config.logger.info('[extension-overrides] overrides.ts changed, restarting server...', {
          timestamp: true,
        });
        server.restart();
      };

      server.watcher.on('add', handleOverridesChange);
      server.watcher.on('change', handleOverridesChange);
      server.watcher.on('unlink', handleOverridesChange);
    },
  };
}

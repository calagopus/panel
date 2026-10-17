import { join } from 'pathe';
import picomatch from 'picomatch';
import type { DirectoryResponse } from '@/api/server/files/loadDirectory.ts';

/**
 * A subuser ignore list with the matching rules wings applies, mirrored from
 * `shared/src/ignore_list.rs` for previews only; the backend and wings decide.
 *
 * Every pattern denies a path's whole subtree, and a `!` line re-includes entries
 * below a directory an earlier line excluded. Such a directory is `descend`: wings
 * still lists it so the re-included entries beneath it can be reached, but denies
 * operations on the directory itself.
 */
export type IgnoreVerdict = 'keep' | 'skip' | 'descend';

interface Glob {
  matches: (path: string) => boolean;
  negated: boolean;
  dirOnly: boolean;
}

interface DescendRule {
  prefix: string;
  tail: number | null;
}

export interface IgnoreList {
  verdict: (path: string, isDir: boolean) => IgnoreVerdict;
  isIgnored: (path: string, isDir: boolean) => boolean;
}

function hasUnclosedClass(pattern: string): boolean {
  let open = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      i++;
    } else if (c === '[') {
      open = true;
    } else if (c === ']' && open) {
      open = false;
    }
  }
  return open;
}

// the `ignore` crate's GitignoreBuilder::add_line
function compileGlob(line: string): Glob | null {
  let negated = false;
  let anchored = false;

  if (line.startsWith('\\!') || line.startsWith('\\#')) {
    line = line.slice(1);
    anchored = line.startsWith('/');
  } else {
    if (line.startsWith('!')) {
      negated = true;
      line = line.slice(1);
    }
    if (line.startsWith('/')) {
      line = line.slice(1);
      anchored = true;
    }
  }

  let dirOnly = false;
  if (line.endsWith('/')) {
    dirOnly = true;
    line = line.slice(0, -1);
    if (line.endsWith('\\')) line = line.slice(0, -1);
  }

  if (hasUnclosedClass(line)) return null;

  let actual = line;
  if (!anchored && !line.includes('/') && !actual.startsWith('**/')) {
    actual = `**/${actual}`;
  }
  if (actual.endsWith('/**')) {
    actual = `${actual}/*`;
  }

  // Gitignore treats parentheses and pipes as literal characters.
  actual = actual.replace(/\\.|[()|]/g, (part) => (part.length === 1 ? `\\${part}` : part));

  try {
    return { matches: picomatch(actual, { dot: true, noext: true }), negated, dirOnly };
  } catch {
    return null;
  }
}

function parseDescendRule(pattern: string): DescendRule | null {
  pattern = pattern.replace(/\/+$/, '');
  if (!pattern.includes('/')) return null;

  const segments = pattern.replace(/^\/+/, '').split('/');
  const literal: string[] = [];
  while (segments.length > 0 && !/[*?[]/.test(segments[0])) {
    literal.push(segments.shift()!);
  }
  if (literal.length === 0) return null;

  const tail = segments.some((segment) => segment.includes('**')) ? null : segments.length;
  return { prefix: literal.join('/'), tail };
}

function ruleCovers(rule: DescendRule, path: string): boolean {
  if (path === rule.prefix) return true;
  if (rule.prefix.startsWith(path)) return rule.prefix[path.length] === '/';
  if (!path.startsWith(rule.prefix) || path[rule.prefix.length] !== '/') return false;

  const rest = path.slice(rule.prefix.length);
  return rule.tail === null || (rest.match(/\//g)?.length ?? 0) < rule.tail;
}

/** Returns `null` for a list wings cannot compile, which denies everything. */
export function compileIgnoreList(lines: string[]): IgnoreList | null {
  const globs: Glob[] = [];
  const descend: DescendRule[] = [];
  let descendAll = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const negated = trimmed.startsWith('!') ? '!' : '';
    const body = negated ? trimmed.slice(1) : trimmed;
    if (body.length === 0 || /^\/+$/.test(body)) continue;

    const glob = compileGlob(trimmed);
    if (!glob) return null;
    globs.push(glob);

    const dirOnly = body.endsWith('/');
    const stem = body.replace(/\/+$/, '');
    let needsDescend = negated.length > 0;
    let companion: string | null = null;
    if (stem.endsWith('/**')) {
      const parent = stem.slice(0, -3);
      if (parent.length === 0) {
        companion = null;
      } else if (dirOnly) {
        needsDescend = true;
      } else if (parent.includes('/')) {
        companion = `${negated}${parent}`;
      } else {
        companion = `${negated}/${parent}`;
      }
    } else if (stem.length === 0) {
      companion = null;
    } else if (stem.includes('/')) {
      companion = `${negated}${stem}/**`;
    } else {
      companion = `${negated}**/${stem}/**`;
    }
    if (companion) {
      const glob = compileGlob(companion);
      if (glob) globs.push(glob);
    }

    if (needsDescend) {
      const rule = parseDescendRule(body);
      if (rule) descend.push(rule);
      else descendAll = true;
    }
  }

  const normalize = (path: string) => path.replace(/^\.\//, '').replace(/^\/+/, '');

  const excluded = (path: string, isDir: boolean) => {
    if (path.length === 0 || path === '.') return false;

    for (let i = globs.length - 1; i >= 0; i--) {
      const glob = globs[i];
      if (glob.dirOnly && !isDir) continue;
      if (glob.matches(path)) return !glob.negated;
    }
    return false;
  };

  const shouldDescend = (path: string) => descendAll || descend.some((rule) => ruleCovers(rule, path));

  return {
    verdict: (path, isDir) => {
      path = normalize(path);
      if (!excluded(path, isDir)) return 'keep';
      if (isDir && shouldDescend(path)) return 'descend';
      return 'skip';
    },
    isIgnored: (path, isDir) => excluded(normalize(path), isDir),
  };
}

export async function countIgnoreMatches(
  pattern: string,
  limit: number,
  loadDirectory: (path: string, page: number) => Promise<DirectoryResponse>,
  signal?: AbortSignal,
): Promise<number> {
  pattern = pattern.trim();
  if (!pattern || pattern.startsWith('#') || pattern.startsWith('!') || limit <= 0) return 0;

  const list = compileIgnoreList([pattern]);
  if (!list) throw new Error('Invalid ignore pattern');

  const directories = ['/'];
  let count = 0;

  for (let index = 0; index < directories.length; index++) {
    for (let page = 1; ; page++) {
      signal?.throwIfAborted();
      const { entries } = await loadDirectory(directories[index], page);
      signal?.throwIfAborted();

      for (const entry of entries.data) {
        const path = join(directories[index], entry.name);
        if (list.isIgnored(path, entry.directory)) {
          count++;
          if (count >= limit) return count;
        }

        if (entry.directory && !entry.symlink) directories.push(path);
      }

      if (page * entries.perPage >= entries.total) break;
    }
  }

  return count;
}

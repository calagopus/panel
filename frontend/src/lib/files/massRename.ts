export type RenameScope = 'name' | 'extension' | 'full';
export type RenameCase = 'none' | 'lower' | 'upper' | 'title' | 'capitalize';
export type RenameStatus = 'unchanged' | 'renamed' | 'invalid' | 'invalidRegex' | 'conflict' | 'duplicate';

export interface MassRenameOptions {
  find: string;
  replace: string;
  regex: boolean;
  caseSensitive: boolean;
  allOccurrences: boolean;
  scope: RenameScope;
  prefix: string;
  suffix: string;
  caseTransform: RenameCase;
  numbering: {
    enabled: boolean;
    start: number;
    step: number;
    padding: number;
  };
}

export interface RenameEntry {
  name: string;
  directory: boolean;
}

export interface RenamePreviewRow {
  name: string;
  directory: boolean;
  newName: string;
  status: RenameStatus;
  included: boolean;
}

const NUMBER_TOKEN = '{n}';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitName(name: string, directory: boolean): { base: string; ext: string } {
  const lastDot = name.lastIndexOf('.');

  if (directory || lastDot <= 0) {
    return { base: name, ext: '' };
  }

  return { base: name.slice(0, lastDot), ext: name.slice(lastDot + 1) };
}

function applyCase(value: string, mode: RenameCase): string {
  switch (mode) {
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    case 'title':
      return value.replace(/[^\s\-_]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    default:
      return value;
  }
}

function computeNewName(
  entry: RenameEntry,
  options: MassRenameOptions,
  index: number,
): { newName: string; invalidRegex: boolean } {
  const { base, ext } = splitName(entry.name, entry.directory);
  let target = options.scope === 'name' ? base : options.scope === 'extension' ? ext : entry.name;

  if (options.find !== '') {
    const flags = `${options.caseSensitive ? '' : 'i'}${options.allOccurrences ? 'g' : ''}`;
    let regex: RegExp;

    try {
      regex = new RegExp(options.regex ? options.find : escapeRegex(options.find), flags);
    } catch {
      return { newName: entry.name, invalidRegex: true };
    }

    target = target.replace(regex, options.replace);
  }

  if (options.prefix !== '' || options.suffix !== '') {
    target = `${options.prefix}${target}${options.suffix}`;
  }

  if (options.numbering.enabled) {
    const value = options.numbering.start + index * options.numbering.step;
    const formatted = Math.abs(value).toString().padStart(options.numbering.padding, '0');
    target = target.split(NUMBER_TOKEN).join(`${value < 0 ? '-' : ''}${formatted}`);
  }

  if (options.caseTransform !== 'none') {
    target = applyCase(target, options.caseTransform);
  }

  if (options.scope === 'name') {
    return { newName: ext ? `${target}.${ext}` : target, invalidRegex: false };
  }

  if (options.scope === 'extension') {
    return { newName: target ? `${base}.${target}` : base, invalidRegex: false };
  }

  return { newName: target, invalidRegex: false };
}

function isValidName(name: string): boolean {
  return name.length > 0 && name.length <= 255 && !name.includes('/');
}

/**
 * Computes the rename preview for every entry, flagging unchanged rows, invalid
 * names, in-batch duplicate targets, and collisions with names that already
 * exist in the directory. `existingNames` should contain every entry name in
 * the current directory; `excluded` contains original names the user opted out
 * of (those keep their current name and still occupy it).
 */
export function buildRenamePreview(
  entries: RenameEntry[],
  options: MassRenameOptions,
  existingNames: Set<string>,
  excluded: Set<string>,
): RenamePreviewRow[] {
  const rows: RenamePreviewRow[] = entries.map((entry, index) => {
    const { newName, invalidRegex } = computeNewName(entry, options, index);

    let status: RenameStatus;
    if (invalidRegex) {
      status = 'invalidRegex';
    } else if (newName === entry.name) {
      status = 'unchanged';
    } else if (!isValidName(newName)) {
      status = 'invalid';
    } else {
      status = 'renamed';
    }

    return {
      name: entry.name,
      directory: entry.directory,
      newName,
      status,
      included: status === 'renamed' && !excluded.has(entry.name),
    };
  });

  const targetCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.included) {
      targetCounts.set(row.newName, (targetCounts.get(row.newName) ?? 0) + 1);
    }
  }

  for (const row of rows) {
    if (!row.included) {
      continue;
    }

    if ((targetCounts.get(row.newName) ?? 0) > 1) {
      row.status = 'duplicate';
      row.included = false;
    } else if (existingNames.has(row.newName)) {
      row.status = 'conflict';
      row.included = false;
    }
  }

  return rows;
}

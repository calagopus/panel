import type { ReactNode } from 'react';

export type ModifierKey = 'ctrl' | 'meta' | 'shift' | 'alt' | 'ctrlOrMeta';

export interface ShortcutBinding {
  key: string;
  modifiers: ModifierKey[];
}

export interface ShortcutCategory {
  id: string;
  label: () => string;
  icon?: ReactNode;
}

export interface ShortcutDefinition {
  id: string;
  category: string;
  description: string | (() => string);
  defaultBinding: ShortcutBinding | null;
  allowWhenInputFocused?: boolean;
  preventDefault?: boolean;
}

export type ShortcutOverride = ShortcutBinding | null;

const MODIFIER_LABELS: Record<ModifierKey, string> = {
  ctrl: 'Ctrl',
  meta: 'Meta',
  shift: 'Shift',
  alt: 'Alt',
  ctrlOrMeta: 'Mod',
};

const MODIFIER_ALIASES: Record<string, ModifierKey> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
  shift: 'shift',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  mod: 'ctrlOrMeta',
  ctrlormeta: 'ctrlOrMeta',
  ctrlorcmd: 'ctrlOrMeta',
};

const MODIFIER_ORDER: ModifierKey[] = ['ctrlOrMeta', 'ctrl', 'meta', 'alt', 'shift'];

function formatKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function formatBinding(binding: ShortcutBinding | null): string {
  if (!binding) return '';

  const parts = MODIFIER_ORDER.filter((m) => binding.modifiers.includes(m)).map((m) => MODIFIER_LABELS[m]);
  parts.push(formatKey(binding.key));
  return parts.join('+');
}

export function parseBinding(text: string): ShortcutBinding | null {
  const tokens = text
    .split('+')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const modifiers: ModifierKey[] = [];
  let key: string | null = null;

  for (const token of tokens) {
    const alias = MODIFIER_ALIASES[token.toLowerCase()];
    if (alias) {
      if (!modifiers.includes(alias)) modifiers.push(alias);
      continue;
    }
    key = token.toLowerCase() === 'space' ? ' ' : token.length === 1 ? token.toLowerCase() : token;
  }

  if (key === null) return null;
  return { key, modifiers };
}

export function bindingsEqual(a: ShortcutBinding | null, b: ShortcutBinding | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.key.toLowerCase() !== b.key.toLowerCase()) return false;
  if (a.modifiers.length !== b.modifiers.length) return false;
  return a.modifiers.every((m) => b.modifiers.includes(m));
}

function eventKey(event: KeyboardEvent): string {
  if (event.code === 'Space') return ' ';
  return event.key;
}

// Map a physical `event.code` to its Latin character. `event.code` describes the
// key's position on the keyboard and is independent of the active layout.
function codeToKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.charAt(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.charAt(5);
  if (/^Numpad[0-9]$/.test(code)) return code.charAt(6);
  return null;
}

function layoutSafeKey(event: KeyboardEvent): string {
  const key = eventKey(event);
  if (/^[a-zA-Z0-9]$/.test(key)) return key;
  return codeToKey(event.code) ?? key;
}

export function bindingFromEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (['Control', 'Meta', 'Shift', 'Alt', 'AltGraph'].includes(event.key)) return null;

  const modifiers: ModifierKey[] = [];
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.metaKey) modifiers.push('meta');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey) modifiers.push('shift');

  return { key: layoutSafeKey(event), modifiers };
}

export function eventKeyMatches(event: KeyboardEvent, key: string): boolean {
  const target = key.toLowerCase();
  return layoutSafeKey(event).toLowerCase() === target || eventKey(event).toLowerCase() === target;
}

function modifiersMatch(event: KeyboardEvent, modifiers: ModifierKey[]): boolean {
  const expectedCtrl = modifiers.includes('ctrl');
  const expectedMeta = modifiers.includes('meta');
  const expectedShift = modifiers.includes('shift');
  const expectedAlt = modifiers.includes('alt');

  if (modifiers.includes('ctrlOrMeta')) {
    if (!event.ctrlKey && !event.metaKey) return false;
  } else {
    if (expectedCtrl !== event.ctrlKey) return false;
    if (expectedMeta !== event.metaKey) return false;
  }

  if (expectedShift !== event.shiftKey) return false;
  if (expectedAlt !== event.altKey) return false;
  return true;
}

export function eventMatchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (!eventKeyMatches(event, binding.key)) return false;
  return modifiersMatch(event, binding.modifiers);
}

export function shortcutDescription(definition: ShortcutDefinition): string {
  return typeof definition.description === 'function' ? definition.description() : definition.description;
}

export function effectiveBinding(
  definition: ShortcutDefinition,
  overrides: Record<string, ShortcutOverride>,
): ShortcutBinding | null {
  if (Object.hasOwn(overrides, definition.id)) return overrides[definition.id];
  return definition.defaultBinding;
}

const EXPORT_HEADER = [
  '# Calagopus keyboard shortcuts',
  '#',
  '# Edit the value after "=" then paste this back to apply your changes.',
  '#   - a key combination such as  Ctrl+Shift+K  or  Mod+S  (Mod = Ctrl/Cmd)',
  '#   - "disabled" turns the shortcut off',
  '#   - "default" restores the shipped binding',
  '# Lines starting with "#" and unknown ids are ignored.',
];

interface SerializeOptions {
  definitions: ShortcutDefinition[];
  overrides: Record<string, ShortcutOverride>;
  categoryLabel?: (categoryId: string) => string;
}

export function serializeShortcuts({ definitions, overrides, categoryLabel }: SerializeOptions): string {
  const labelOf = categoryLabel ?? ((id: string) => id);

  const byCategory = new Map<string, ShortcutDefinition[]>();
  for (const def of definitions) {
    const list = byCategory.get(def.category) ?? [];
    list.push(def);
    byCategory.set(def.category, list);
  }

  const idWidth = Math.min(
    40,
    definitions.reduce((max, d) => Math.max(max, d.id.length), 0),
  );

  const lines = [...EXPORT_HEADER];
  for (const category of Array.from(byCategory.keys()).sort((a, b) => labelOf(a).localeCompare(labelOf(b)))) {
    const label = labelOf(category);
    lines.push('', label === category ? `[${category}]` : `[${category}] # ${label}`);
    for (const def of byCategory.get(category)!) {
      const binding = effectiveBinding(def, overrides);
      const value = binding === null ? 'disabled' : formatBinding(binding);
      lines.push(`# ${shortcutDescription(def)}`);
      lines.push(`${def.id.padEnd(idWidth)} = ${value}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export interface ParsedShortcuts {
  overrides: Record<string, ShortcutOverride>;
  resets: string[];
  unknown: string[];
  invalid: string[];
}

const LINE_PATTERN = /^([^=\s]+)\s*=\s*(.+?)\s*$/;

export function parseShortcuts(text: string, definitions: ShortcutDefinition[]): ParsedShortcuts {
  const result: ParsedShortcuts = { overrides: {}, resets: [], unknown: [], invalid: [] };
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;

    const match = LINE_PATTERN.exec(line);
    if (!match) {
      result.invalid.push(rawLine);
      continue;
    }

    const id = match[1];
    const value = match[2].trim();
    const definition = byId.get(id);
    if (!definition) {
      result.unknown.push(id);
      continue;
    }

    const lowered = value.toLowerCase();
    if (lowered === 'default') {
      result.resets.push(id);
      continue;
    }
    if (lowered === 'disabled' || lowered === 'none' || lowered === 'off') {
      if (definition.defaultBinding === null) result.resets.push(id);
      else result.overrides[id] = null;
      continue;
    }

    const binding = parseBinding(value);
    if (!binding) {
      result.invalid.push(rawLine);
      continue;
    }

    if (bindingsEqual(binding, definition.defaultBinding)) result.resets.push(id);
    else result.overrides[id] = binding;
  }

  return result;
}

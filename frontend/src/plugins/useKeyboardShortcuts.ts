import { type DependencyList, useEffect, useRef } from 'react';
import { getShortcutDefinition } from '@/lib/coreShortcuts.tsx';
import { effectiveBinding, eventMatchesBinding, ModifierKey, ShortcutBinding } from '@/lib/shortcuts.ts';
import { getGlobalStore } from '@/stores/global.ts';

export type { ModifierKey };

interface ShortcutConfigBase {
  callback: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  allowWhenInputFocused?: boolean;
}

interface RegisteredShortcutConfig extends ShortcutConfigBase {
  id: string;
  key?: never;
  modifiers?: never;
}

interface InlineShortcutConfig extends ShortcutConfigBase {
  id?: never;
  key: string;
  modifiers?: ModifierKey[];
}

type ShortcutConfig = RegisteredShortcutConfig | InlineShortcutConfig;

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutConfig[];
  enabled?: boolean;
  deps?: DependencyList;
}

interface ResolvedShortcut {
  binding: ShortcutBinding | null;
  allowWhenInputFocused: boolean;
  preventDefault: boolean;
}

function resolveShortcut(shortcut: ShortcutConfig): ResolvedShortcut {
  if (shortcut.id !== undefined) {
    const definition = getShortcutDefinition(shortcut.id);
    return {
      binding: definition ? effectiveBinding(definition, getGlobalStore().shortcutOverrides) : null,
      allowWhenInputFocused: shortcut.allowWhenInputFocused ?? definition?.allowWhenInputFocused ?? false,
      preventDefault: shortcut.preventDefault ?? definition?.preventDefault ?? true,
    };
  }

  return {
    binding: { key: shortcut.key, modifiers: shortcut.modifiers ?? [] },
    allowWhenInputFocused: shortcut.allowWhenInputFocused ?? false,
    preventDefault: shortcut.preventDefault ?? true,
  };
}

function isInputFocused(): boolean {
  const target = document.activeElement as HTMLElement | null;
  return target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true, deps = [] }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const inputFocused = isInputFocused();

      for (const shortcut of shortcutsRef.current) {
        const { binding, allowWhenInputFocused, preventDefault } = resolveShortcut(shortcut);

        if (!binding) continue;
        if (inputFocused && !allowWhenInputFocused) continue;
        if (!eventMatchesBinding(event, binding)) continue;

        if (preventDefault) event.preventDefault();
        shortcut.callback(event);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, ...deps]);
}

export function useKeyboardShortcut(
  key: string,
  callback: (event: KeyboardEvent) => void,
  options: {
    id?: string;
    modifiers?: ModifierKey[];
    preventDefault?: boolean;
    allowWhenInputFocused?: boolean;
    enabled?: boolean;
    deps?: DependencyList;
  } = {},
) {
  const { id, modifiers, preventDefault, allowWhenInputFocused, enabled = true, deps = [] } = options;

  const shortcut: ShortcutConfig = id
    ? { id, callback, preventDefault, allowWhenInputFocused }
    : { key, modifiers, callback, preventDefault, allowWhenInputFocused };

  useKeyboardShortcuts({ shortcuts: [shortcut], enabled, deps });
}

export function matchesShortcut(event: KeyboardEvent, id: string): boolean {
  const definition = getShortcutDefinition(id);
  if (!definition) return false;

  const binding = effectiveBinding(definition, getGlobalStore().shortcutOverrides);
  return binding ? eventMatchesBinding(event, binding) : false;
}

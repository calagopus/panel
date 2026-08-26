import { z } from 'zod';
import { ModifierKey, ShortcutBinding, ShortcutOverride } from '@/lib/quickActions/shortcuts.ts';
import { UserSettingValue } from '@/lib/schemas/user/settings.ts';
import { getUserSetting, setUserSetting, useUserSetting } from '@/lib/userSettings.ts';

export const SHORTCUT_OVERRIDES_KEY = 'shortcuts::overrides';

const MODIFIER_KEYS = ['ctrl', 'meta', 'shift', 'alt', 'ctrlOrMeta'] as const satisfies readonly ModifierKey[];

const shortcutOverridesSchema = z.record(
  z.string(),
  z.object({ key: z.string(), modifiers: z.array(z.enum(MODIFIER_KEYS)) }).nullable(),
);

const NO_OVERRIDES: Record<string, ShortcutOverride> = {};

export function getShortcutOverrides(): Record<string, ShortcutOverride> {
  return getUserSetting(SHORTCUT_OVERRIDES_KEY, shortcutOverridesSchema, NO_OVERRIDES);
}

export function useShortcutOverrides(): Record<string, ShortcutOverride> {
  return useUserSetting(SHORTCUT_OVERRIDES_KEY, shortcutOverridesSchema, NO_OVERRIDES)[0];
}

function updateOverrides(update: (overrides: Record<string, ShortcutOverride>) => Record<string, ShortcutOverride>) {
  setUserSetting(SHORTCUT_OVERRIDES_KEY, update(getShortcutOverrides()) as UserSettingValue);
}

export function setShortcutBinding(id: string, binding: ShortcutBinding) {
  updateOverrides((overrides) => ({ ...overrides, [id]: binding }));
}

export function disableShortcut(id: string) {
  updateOverrides((overrides) => ({ ...overrides, [id]: null }));
}

export function resetShortcut(id: string) {
  updateOverrides((overrides) => {
    const { [id]: _, ...rest } = overrides;
    return rest;
  });
}

export function resetAllShortcuts() {
  setUserSetting(SHORTCUT_OVERRIDES_KEY, {});
}

export function importShortcutOverrides(overrides: Record<string, ShortcutOverride>, resets: string[]) {
  updateOverrides((current) => {
    const next = { ...current, ...overrides };
    for (const id of resets) delete next[id];
    return next;
  });
}

import { StateCreator } from 'zustand';
import { ShortcutBinding, ShortcutOverride } from '@/lib/shortcuts.ts';
import { GlobalStore } from '@/stores/global.ts';

export interface ShortcutsSlice {
  shortcutOverrides: Record<string, ShortcutOverride>;

  setShortcutBinding: (id: string, binding: ShortcutBinding) => void;
  disableShortcut: (id: string) => void;
  resetShortcut: (id: string) => void;
  resetAllShortcuts: () => void;
  importShortcutOverrides: (overrides: Record<string, ShortcutOverride>, resets: string[]) => void;
}

export const createShortcutsSlice: StateCreator<GlobalStore, [], [], ShortcutsSlice> = (set): ShortcutsSlice => ({
  shortcutOverrides: {},

  setShortcutBinding: (id, binding) =>
    set((state) => ({ shortcutOverrides: { ...state.shortcutOverrides, [id]: binding } })),

  disableShortcut: (id) => set((state) => ({ shortcutOverrides: { ...state.shortcutOverrides, [id]: null } })),

  resetShortcut: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.shortcutOverrides;
      return { shortcutOverrides: rest };
    }),

  resetAllShortcuts: () => set({ shortcutOverrides: {} }),

  importShortcutOverrides: (overrides, resets) =>
    set((state) => {
      const next = { ...state.shortcutOverrides, ...overrides };
      for (const id of resets) delete next[id];
      return { shortcutOverrides: next };
    }),
});

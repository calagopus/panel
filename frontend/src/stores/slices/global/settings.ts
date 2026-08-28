import { z } from 'zod';
import { StateCreator } from 'zustand';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';
import { GlobalStore } from '@/stores/global.ts';

export interface SettingsSlice {
  settings: z.infer<typeof publicSettingsSchema>;
  languages: string[];
  serverName: string | null;

  setSettings: (settings: z.infer<typeof publicSettingsSchema>) => void;
  updateSettings: (settings: Partial<z.infer<typeof publicSettingsSchema>>) => void;
  setLanguages: (languages: string[]) => void;
  setServerName: (name: string | null) => void;
}

export const createSettingsSlice: StateCreator<GlobalStore, [], [], SettingsSlice> = (set): SettingsSlice => ({
  settings: {} as z.infer<typeof publicSettingsSchema>,
  languages: [],
  serverName: null,

  setSettings: (value) => set((state) => ({ ...state, settings: value })),
  updateSettings: (value) => set((state) => ({ ...state, settings: { ...state.settings, ...value } })),
  setLanguages: (value) => set((state) => ({ ...state, languages: value })),
  setServerName: (value) => set((state) => ({ ...state, serverName: value })),
});

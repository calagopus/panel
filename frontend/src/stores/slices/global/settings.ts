import { z } from 'zod';
import { StateCreator } from 'zustand';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';
import { GlobalStore } from '@/stores/global.ts';

export interface SettingsSlice {
  serverListShowOthers: boolean;
  settings: z.infer<typeof publicSettingsSchema>;
  languages: string[];
  serverName: string | null;

  setServerListShowOthers: (show: boolean) => void;
  setSettings: (settings: z.infer<typeof publicSettingsSchema>) => void;
  updateSettings: (settings: Partial<z.infer<typeof publicSettingsSchema>>) => void;
  setLanguages: (languages: string[]) => void;
  setServerName: (name: string | null) => void;
}

export const createSettingsSlice: StateCreator<GlobalStore, [], [], SettingsSlice> = (set): SettingsSlice => ({
  serverListShowOthers: false,
  settings: {} as z.infer<typeof publicSettingsSchema>,
  languages: [],
  serverName: null,

  setServerListShowOthers: (value) => set((state) => ({ ...state, serverListShowOthers: value })),
  setSettings: (value) => set((state) => ({ ...state, settings: value })),
  updateSettings: (value) => set((state) => ({ ...state, settings: { ...state.settings, ...value } })),
  setLanguages: (value) => set((state) => ({ ...state, languages: value })),
  setServerName: (value) => set((state) => ({ ...state, serverName: value })),
});

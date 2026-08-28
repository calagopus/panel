import { create } from 'zustand';
import { UserSettingsMap } from '@/lib/schemas/user/settings.ts';

export interface UserSettingsStore {
  userUuid: string | null;
  serverLoaded: boolean;
  synced: UserSettingsMap;
  local: UserSettingsMap;
}

export const useUserSettingsStore = create<UserSettingsStore>()(() => ({
  userUuid: null,
  serverLoaded: false,
  synced: {},
  local: {},
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnnouncementsSlice, createAnnouncementsSlice } from './slices/global/announcements.ts';
import { createPermissionsSlice, PermissionsSlice } from './slices/global/permissions.ts';
import { createSettingsSlice, SettingsSlice } from './slices/global/settings.ts';
import { createShortcutsSlice, ShortcutsSlice } from './slices/global/shortcuts.ts';
import { createTimeSlice, TimeSlice } from './slices/global/time.ts';

export interface GlobalStore extends AnnouncementsSlice, PermissionsSlice, SettingsSlice, ShortcutsSlice, TimeSlice {}

export const useGlobalStore = create<GlobalStore>()(
  persist(
    (...a) => ({
      ...createAnnouncementsSlice(...a),
      ...createPermissionsSlice(...a),
      ...createSettingsSlice(...a),
      ...createShortcutsSlice(...a),
      ...createTimeSlice(...a),
    }),
    { name: 'global' },
  ),
);

export function getGlobalStore() {
  return useGlobalStore.getState();
}

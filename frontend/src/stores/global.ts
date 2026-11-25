import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnnouncementsSlice, createAnnouncementsSlice } from './slices/global/announcements.ts';
import { createIconsSlice, IconsSlice } from './slices/global/icons.ts';
import { createSettingsSlice, SettingsSlice } from './slices/global/settings.ts';
import { createTimeSlice, TimeSlice } from './slices/global/time.ts';

export interface GlobalStore extends AnnouncementsSlice, IconsSlice, SettingsSlice, TimeSlice {}

export const useGlobalStore = create<GlobalStore>()(
  persist(
    (...a) => ({
      ...createAnnouncementsSlice(...a),
      ...createIconsSlice(...a),
      ...createSettingsSlice(...a),
      ...createTimeSlice(...a),
    }),
    { name: 'global' },
  ),
);

export function getGlobalStore() {
  return useGlobalStore.getState();
}

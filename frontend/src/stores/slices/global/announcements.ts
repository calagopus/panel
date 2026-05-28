import { z } from 'zod';
import { StateCreator } from 'zustand';
import { announcementSchema } from '@/lib/schemas/announcements.ts';
import { GlobalStore } from '@/stores/global.ts';

export interface AnnouncementsSlice {
  announcements: z.infer<typeof announcementSchema>[];
  setAnnouncements: (announcements: z.infer<typeof announcementSchema>[]) => void;
}

export const createAnnouncementsSlice: StateCreator<GlobalStore, [], [], AnnouncementsSlice> = (
  set,
): AnnouncementsSlice => ({
  announcements: [],
  setAnnouncements: (value) => set((state) => ({ ...state, announcements: value })),
});

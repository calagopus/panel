import { z } from 'zod';
import { StateCreator } from 'zustand';
import { announcementSchema } from '@/lib/schemas/announcements.ts';
import { ServerStore } from '@/stores/server.ts';

export interface ServerAnnouncementsSlice {
  serverAnnouncements: z.infer<typeof announcementSchema>[];
  setServerAnnouncements: (announcements: z.infer<typeof announcementSchema>[]) => void;
}

export const createServerAnnouncementsSlice: StateCreator<ServerStore, [], [], ServerAnnouncementsSlice> = (
  set,
): ServerAnnouncementsSlice => ({
  serverAnnouncements: [],
  setServerAnnouncements: (value) => set((state) => ({ ...state, serverAnnouncements: value })),
});

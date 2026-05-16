import { z } from 'zod';
import { StateCreator } from 'zustand';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';
import { AdminStore } from '@/stores/admin.tsx';

export interface AnnouncementsSlice {
  announcements: Pagination<z.infer<typeof adminAnnouncementSchema>>;

  setAnnouncements: (announcements: Pagination<z.infer<typeof adminAnnouncementSchema>>) => void;
  addAnnouncement: (announcement: z.infer<typeof adminAnnouncementSchema>) => void;
  removeAnnouncement: (announcement: z.infer<typeof adminAnnouncementSchema>) => void;
}

export const createAnnouncementsSlice: StateCreator<AdminStore, [], [], AnnouncementsSlice> = (
  set,
): AnnouncementsSlice => ({
  announcements: getEmptyPaginationSet<z.infer<typeof adminAnnouncementSchema>>(),

  setAnnouncements: (value) => set((state) => ({ ...state, announcements: value })),
  addAnnouncement: (announcement) =>
    set((state) => ({
      announcements: {
        ...state.announcements,
        data: [...state.announcements.data, announcement],
        total: state.announcements.total + 1,
      },
    })),
  removeAnnouncement: (announcement) =>
    set((state) => ({
      announcements: {
        ...state.announcements,
        data: state.announcements.data.filter((a) => a.uuid !== announcement.uuid),
        total: state.announcements.total - 1,
      },
    })),
});

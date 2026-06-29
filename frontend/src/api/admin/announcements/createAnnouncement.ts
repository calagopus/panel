import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminAnnouncementCreateSchema, adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';

export default async (
  announcementData: z.infer<typeof adminAnnouncementCreateSchema>,
): Promise<z.infer<typeof adminAnnouncementSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/announcements',
    serializeForApi(adminAnnouncementCreateSchema, announcementData),
  );
  return data.announcement;
};

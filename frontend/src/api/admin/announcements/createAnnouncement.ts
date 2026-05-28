import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminAnnouncementCreateSchema, adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  announcementData: z.infer<typeof adminAnnouncementCreateSchema>,
): Promise<z.infer<typeof adminAnnouncementSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/announcements', {
    ...transformKeysToSnakeCase(announcementData),
    enabled_start: announcementData.enabledStart ? announcementData.enabledStart.toISOString() : null,
    enabled_end: announcementData.enabledEnd ? announcementData.enabledEnd.toISOString() : null,
  });
  return data.announcement;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';

export default async (announcementUuid: string): Promise<z.infer<typeof adminAnnouncementSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/announcements/${announcementUuid}`);
  return parseFromApi(adminAnnouncementSchema, data.announcement);
};

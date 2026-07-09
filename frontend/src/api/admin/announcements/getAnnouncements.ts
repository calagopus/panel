import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof adminAnnouncementSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/announcements', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminAnnouncementSchema, data.announcements);
};

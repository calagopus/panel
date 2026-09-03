import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { announcementSchema } from '@/lib/schemas/announcements.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof announcementSchema>[]> => {
  const { data } = await axiosInstance.get('/api/announcements');
  return data.announcements.map((item: unknown) => parseFromApi(announcementSchema, item));
};

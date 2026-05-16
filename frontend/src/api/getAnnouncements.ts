import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { announcementSchema } from '@/lib/schemas/announcements.ts';

export default async (): Promise<z.infer<typeof announcementSchema>[]> => {
  const { data } = await axiosInstance.get('/api/announcements');
  return data.announcements;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { announcementSchema } from '@/lib/schemas/announcements.ts';

export default async (serverUuid: string): Promise<z.infer<typeof announcementSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/announcements`);
  return data.announcements;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { announcementSchema } from '@/lib/schemas/announcements.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (serverUuid: string): Promise<z.infer<typeof announcementSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/announcements`);
  return data.announcements.map((item: unknown) => parseFromApi(announcementSchema, item));
};

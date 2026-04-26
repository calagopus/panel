import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverScheduleSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/schedules`, {
    params: { page, search },
  });
  return data.schedules;
};

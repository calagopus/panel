import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  name: string,
): Promise<z.infer<typeof serverScheduleSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/duplicate`, {
    name,
  });
  return parseFromApi(serverScheduleSchema, data.schedule);
};

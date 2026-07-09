import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverScheduleStatusSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
): Promise<z.infer<typeof serverScheduleStatusSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/status`);
  return parseFromApi(serverScheduleStatusSchema, data.status);
};

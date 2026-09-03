import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleStatusSchema } from '@/lib/schemas/server/schedules.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
): Promise<z.infer<typeof serverScheduleStatusSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/status`);
  return parseFromApi(serverScheduleStatusSchema, data.status);
};

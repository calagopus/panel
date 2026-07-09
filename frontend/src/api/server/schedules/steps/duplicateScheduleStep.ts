import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  stepUuid: string,
): Promise<z.infer<typeof serverScheduleStepSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps/${stepUuid}/duplicate`,
  );
  return parseFromApi(serverScheduleStepSchema, data.schedule_step);
};

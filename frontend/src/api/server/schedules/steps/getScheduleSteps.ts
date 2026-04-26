import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
): Promise<z.infer<typeof serverScheduleStepSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps`);
  return data.scheduleSteps;
};

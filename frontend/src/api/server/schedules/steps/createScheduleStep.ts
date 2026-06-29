import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleStepSchema, serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  scheduleStepData: z.infer<typeof serverScheduleStepUpdateSchema>,
): Promise<z.infer<typeof serverScheduleStepSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps`,
    transformKeysToSnakeCase(scheduleStepData),
  );
  return data.scheduleStep;
};

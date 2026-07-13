import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { serverScheduleStepSchema, serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  scheduleStepData: z.infer<typeof serverScheduleStepUpdateSchema>,
): Promise<z.infer<typeof serverScheduleStepSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps`,
    serializeForApi(serverScheduleStepUpdateSchema, scheduleStepData),
  );
  return parseFromApi(serverScheduleStepSchema, data.schedule_step);
};

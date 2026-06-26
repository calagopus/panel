import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  stepUuid: string,
  data: z.infer<typeof serverScheduleStepUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps/${stepUuid}`,
    serializeForApi(serverScheduleStepUpdateSchema, data),
  );
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  stepUuid: string,
  data: z.infer<typeof serverScheduleStepUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps/${stepUuid}`,
    transformKeysToSnakeCase(data),
  );
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  data: Partial<z.infer<typeof serverScheduleUpdateSchema>>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}`,
    transformKeysToSnakeCase(data),
  );
};

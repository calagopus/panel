import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  uuid: string,
  scheduleData: z.infer<typeof serverScheduleUpdateSchema>,
): Promise<z.infer<typeof serverScheduleSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/schedules`,
    transformKeysToSnakeCase(scheduleData),
  );
  return data.schedule;
};

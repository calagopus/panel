import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  scheduleData: z.infer<typeof serverScheduleUpdateSchema>,
): Promise<z.infer<typeof serverScheduleSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/schedules`,
    serializeForApi(serverScheduleUpdateSchema, scheduleData),
  );
  return parseFromApi(serverScheduleSchema, data.schedule);
};

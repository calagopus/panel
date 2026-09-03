import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverUuid: string,
  scheduleUuid: string,
  data: Partial<z.infer<typeof serverScheduleUpdateSchema>>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}`,
    serializeForApi(serverScheduleUpdateSchema, data as z.infer<typeof serverScheduleUpdateSchema>),
  );
};

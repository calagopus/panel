import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverScheduleSchema } from '@/lib/schemas/server/schedules.ts';

export default async (serverUuid: string, scheduleUuid: string): Promise<z.infer<typeof serverScheduleSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}`);
  return data.schedule;
};

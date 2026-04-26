import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string, skipCondition: boolean): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/trigger`, {
    skip_condition: skipCondition,
  });
};

import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string, stepUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps/${stepUuid}`);
};

import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}`);
};

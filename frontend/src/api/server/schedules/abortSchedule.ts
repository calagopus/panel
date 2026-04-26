import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/abort`);
};

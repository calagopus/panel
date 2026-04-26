import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string, order: string[]): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/steps/order`, {
    schedule_step_order: order,
  });
};

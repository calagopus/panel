import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, scheduleUuid: string): Promise<object> => {
  const { data } = await untransformedAxiosInstance.get(
    `/api/client/servers/${serverUuid}/schedules/${scheduleUuid}/export`,
  );
  return data;
};

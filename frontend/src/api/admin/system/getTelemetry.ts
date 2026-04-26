import { axiosInstance } from '@/api/axios.ts';

export default async (): Promise<object> => {
  const { data } = await axiosInstance.get('/api/admin/system/telemetry');
  return data.telemetry;
};

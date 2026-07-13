import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<object> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/config`);
  return data.config;
};

import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/token`);
  return data.token;
};

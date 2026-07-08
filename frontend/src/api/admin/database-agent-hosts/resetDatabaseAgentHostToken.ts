import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/admin/database-agent-hosts/${hostUuid}/reset-token`);
  return data.token;
};

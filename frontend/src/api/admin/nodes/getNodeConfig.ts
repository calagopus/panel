import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string): Promise<object> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/config`);
  return data.config;
};

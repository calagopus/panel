import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string): Promise<object> => {
  const { data } = await untransformedAxiosInstance.get(`/api/admin/nodes/${nodeUuid}/config`);
  return data.config;
};

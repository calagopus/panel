import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string): Promise<{ tokenId: string; token: string }> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/reset-token`);
  return data;
};

import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, config: object): Promise<boolean> => {
  const { data } = await axiosInstance.patch(`/api/admin/nodes/${nodeUuid}/config`, config);
  return data.applied;
};

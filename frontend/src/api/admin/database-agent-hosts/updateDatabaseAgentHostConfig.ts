import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string, config: object): Promise<boolean> => {
  const { data } = await untransformedAxiosInstance.patch(`/api/admin/database-agent-hosts/${hostUuid}/config`, config);
  return data.applied;
};

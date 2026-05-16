import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (nodeUuids: string[], config: object): Promise<number> => {
  const { data } = await untransformedAxiosInstance.patch('/api/admin/nodes/config', {
    node_uuids: nodeUuids,
    config,
  });
  return data.applied;
};

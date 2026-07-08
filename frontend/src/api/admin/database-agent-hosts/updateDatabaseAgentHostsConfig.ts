import { untransformedAxiosInstance } from '@/api/axios.ts';

export default async (hostUuids: string[], config: object): Promise<number> => {
  const { data } = await untransformedAxiosInstance.patch('/api/admin/database-agent-hosts/config', {
    database_agent_host_uuids: hostUuids,
    config,
  });
  return data.applied;
};

import { axiosInstance } from '@/api/axios.ts';

export default async (locationUuid: string, hostUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/locations/${locationUuid}/database-agent-hosts`, {
    database_agent_host_uuid: hostUuid,
  });
};

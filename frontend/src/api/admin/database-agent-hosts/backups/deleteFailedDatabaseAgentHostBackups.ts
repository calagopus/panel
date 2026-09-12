import { axiosInstance } from '@/api/axios.ts';

interface Data {
  force: boolean;
}

export default async (databaseAgentHostUuid: string, data: Data): Promise<number> => {
  const { data: response } = await axiosInstance.post(
    `/api/admin/database-agent-hosts/${databaseAgentHostUuid}/backups/delete-failed`,
    data,
  );
  return response.queued;
};

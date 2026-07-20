import { axiosInstance } from '@/api/axios.ts';

export default async (templateUuid: string, instanceUuids: string[]): Promise<{ updated: number }> => {
  const { data } = await axiosInstance.post(`/api/admin/database-agent-templates/${templateUuid}/instances/update`, {
    instance_uuids: instanceUuids,
  });
  return data;
};

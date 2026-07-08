import { axiosInstance } from '@/api/axios.ts';

export default async (templateUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/database-agent-templates/${templateUuid}`);
};

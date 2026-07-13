import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminDatabaseAgentTemplateSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/database-agent-templates', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminDatabaseAgentTemplateSchema, data.database_agent_templates);
};

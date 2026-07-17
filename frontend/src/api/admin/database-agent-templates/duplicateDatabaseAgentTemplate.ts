import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';

export default async (
  templateUuid: string,
  name: string,
): Promise<z.infer<typeof adminDatabaseAgentTemplateSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/database-agent-templates/${templateUuid}/duplicate`, { name });
  return parseFromApi(adminDatabaseAgentTemplateSchema, data.database_agent_template);
};

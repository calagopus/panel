import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminDatabaseAgentTemplateCreateSchema,
  adminDatabaseAgentTemplateSchema,
} from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  templateData: z.infer<typeof adminDatabaseAgentTemplateCreateSchema>,
): Promise<z.infer<typeof adminDatabaseAgentTemplateSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/database-agent-templates',
    serializeForApi(
      adminDatabaseAgentTemplateCreateSchema,
      templateData,
      formExtensionSchemas('admin.databaseAgentTemplates.createOrUpdate'),
    ),
  );
  return parseFromApi(adminDatabaseAgentTemplateSchema, data.database_agent_template);
};

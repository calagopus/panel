import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminDatabaseAgentTemplateUpdateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';

export default async (
  templateUuid: string,
  data: z.infer<typeof adminDatabaseAgentTemplateUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/database-agent-templates/${templateUuid}`,
    serializeForApi(
      adminDatabaseAgentTemplateUpdateSchema,
      data,
      formExtensionSchemas('admin.databaseAgentTemplates.createOrUpdate'),
    ),
  );
};

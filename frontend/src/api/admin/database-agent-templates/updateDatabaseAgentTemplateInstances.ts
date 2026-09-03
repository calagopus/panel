import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const instanceSelectorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uuids'), uuids: z.array(z.string()) }),
  z.object({ type: z.literal('outdated') }),
]);

const updateDatabaseAgentTemplateInstancesSchema = z.object({
  instances: instanceSelectorSchema,
});

export default async (
  templateUuid: string,
  instances: z.infer<typeof instanceSelectorSchema>,
): Promise<{ updated: number }> => {
  const { data } = await axiosInstance.post(
    `/api/admin/database-agent-templates/${templateUuid}/instances/update`,
    serializeForApi(updateDatabaseAgentTemplateInstancesSchema, { instances }),
  );
  return data;
};

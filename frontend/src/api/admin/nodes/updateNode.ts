import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string, data: z.infer<typeof adminNodeUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/nodes/${nodeUuid}`,
    serializeForApi(adminNodeUpdateSchema, data, formExtensionSchemas('admin.nodes.createOrUpdate')),
  );
};

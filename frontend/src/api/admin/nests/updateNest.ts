import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (nestUuid: string, data: z.infer<typeof adminNestUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/nests/${nestUuid}`,
    serializeForApi(adminNestUpdateSchema, data, formExtensionSchemas('admin.nests.createOrUpdate')),
  );
};

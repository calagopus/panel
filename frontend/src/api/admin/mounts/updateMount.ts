import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (mountUuid: string, data: z.infer<typeof adminMountUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/mounts/${mountUuid}`,
    serializeForApi(adminMountUpdateSchema, data, formExtensionSchemas('admin.mounts.createOrUpdate')),
  );
};

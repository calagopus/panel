import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

const extensionStatusSchema = z.object({
  isBuilding: z.boolean(),
  pendingExtensions: z.array(adminBackendExtensionSchema),
  removedExtensions: z.array(adminBackendExtensionSchema),
});

export type ExtensionStatus = z.infer<typeof extensionStatusSchema>;

export default async (): Promise<ExtensionStatus> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/manage/status');
  return parseFromApi(extensionStatusSchema, data);
};

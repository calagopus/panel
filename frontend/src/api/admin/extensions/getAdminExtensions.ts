import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

export default async (): Promise<z.infer<typeof adminBackendExtensionSchema>[]> => {
  const { data } = await axiosInstance.get('/api/admin/extensions');
  return data.extensions.map((item: unknown) => parseFromApi(adminBackendExtensionSchema, item));
};

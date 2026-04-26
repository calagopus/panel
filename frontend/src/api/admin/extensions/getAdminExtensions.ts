import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminBackendExtensionSchema } from '@/lib/schemas/admin/backendExtension.ts';

export default async (): Promise<z.infer<typeof adminBackendExtensionSchema>[]> => {
  const { data } = await axiosInstance.get('/api/admin/extensions');
  return data.extensions;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsStorageSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    storage_driver: transformKeysToSnakeCase(data),
  });
};

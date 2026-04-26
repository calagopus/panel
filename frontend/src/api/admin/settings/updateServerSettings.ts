import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsSchema>['server']): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    server: transformKeysToSnakeCase(data),
  });
};

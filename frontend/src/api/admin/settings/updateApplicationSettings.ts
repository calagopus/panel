import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsApplicationSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    app: transformKeysToSnakeCase(data),
  });
};

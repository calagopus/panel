import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsEmailSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    mail_mode: transformKeysToSnakeCase(data),
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsWebauthnSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    webauthn: transformKeysToSnakeCase(data),
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsWebauthnSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    webauthn: serializeForApi(adminSettingsWebauthnSchema, data),
  });
};

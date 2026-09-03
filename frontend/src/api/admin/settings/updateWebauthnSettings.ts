import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (data: z.infer<typeof adminSettingsWebauthnSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    webauthn: serializeForApi(adminSettingsWebauthnSchema, data, formExtensionSchemas('admin.settings.webauthn')),
  });
};

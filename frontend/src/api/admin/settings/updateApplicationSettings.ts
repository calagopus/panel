import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsApplicationSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    app: serializeForApi(adminSettingsApplicationSchema, data),
  });
};

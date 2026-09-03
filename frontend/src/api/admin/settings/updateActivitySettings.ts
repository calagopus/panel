import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsActivitySchema } from '@/lib/schemas/admin/settings.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (data: z.infer<typeof adminSettingsActivitySchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    activity: serializeForApi(adminSettingsActivitySchema, data),
  });
};

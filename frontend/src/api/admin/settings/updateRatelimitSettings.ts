import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsRatelimitsSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    ratelimits: serializeForApi(adminSettingsRatelimitsSchema, data),
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsRatelimitsSchema>): Promise<void> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .put('/api/admin/settings', {
        ratelimits: transformKeysToSnakeCase(data),
      })
      .then(() => resolve())
      .catch(reject);
  });
};

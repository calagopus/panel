import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsCaptchaProviderSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (data: z.infer<typeof adminSettingsCaptchaProviderSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    captcha_provider: transformKeysToSnakeCase(data),
  });
};

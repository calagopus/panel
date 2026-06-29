import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsCaptchaProviderSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsCaptchaProviderSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    captcha_provider: serializeForApi(adminSettingsCaptchaProviderSchema, data),
  });
};

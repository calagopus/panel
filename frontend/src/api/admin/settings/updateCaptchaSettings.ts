import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsCaptchaProviderSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsCaptchaProviderSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    captcha_provider: serializeForApi(adminSettingsCaptchaProviderSchema, data, [
      ...formExtensionSchemas('admin.settings.captcha.hcaptcha'),
      ...formExtensionSchemas('admin.settings.captcha.recaptcha'),
      ...formExtensionSchemas('admin.settings.captcha.turnstile'),
      ...formExtensionSchemas('admin.settings.captcha.friendlyCaptcha'),
    ]),
  });
};

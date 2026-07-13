import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsEmailSchema } from '@/lib/schemas/admin/settings.ts';

export default async (data: z.infer<typeof adminSettingsEmailSchema>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    mail_mode: serializeForApi(adminSettingsEmailSchema, data, [
      ...formExtensionSchemas('admin.settings.email.sendmail'),
      ...formExtensionSchemas('admin.settings.email.smtp'),
      ...formExtensionSchemas('admin.settings.email.file'),
    ]),
  });
};

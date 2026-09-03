import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailTemplateListSchema } from '@/lib/schemas/admin/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminSettingsEmailTemplateListSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system/email/templates');
  return parseFromApi(adminSettingsEmailTemplateListSchema, data.email_templates);
};

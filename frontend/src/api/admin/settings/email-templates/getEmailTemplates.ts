import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailTemplateListSchema } from '@/lib/schemas/admin/settings.ts';

export default async (): Promise<z.infer<typeof adminSettingsEmailTemplateListSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/system/email/templates');
  return data.emailTemplates;
};

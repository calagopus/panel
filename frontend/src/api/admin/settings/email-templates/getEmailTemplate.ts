import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminSettingsEmailTemplateSchema } from '@/lib/schemas/admin/settings.ts';

export default async (templateIdentifier: string): Promise<z.infer<typeof adminSettingsEmailTemplateSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/system/email/templates/${templateIdentifier}`);
  return parseFromApi(adminSettingsEmailTemplateSchema, data.email_template);
};

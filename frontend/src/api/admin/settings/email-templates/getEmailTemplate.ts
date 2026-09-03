import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailTemplateSchema } from '@/lib/schemas/admin/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (templateIdentifier: string): Promise<z.infer<typeof adminSettingsEmailTemplateSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/system/email/templates/${templateIdentifier}`);
  return parseFromApi(adminSettingsEmailTemplateSchema, data.email_template);
};

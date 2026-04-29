import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailTemplateUpdateSchema } from '@/lib/schemas/admin/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  templateIdentifier: string,
  data: z.infer<typeof adminSettingsEmailTemplateUpdateSchema>,
): Promise<void> => {
  await axiosInstance.put(`/api/admin/system/email/templates/${templateIdentifier}`, transformKeysToSnakeCase(data));
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminSettingsEmailTemplateUpdateSchema } from '@/lib/schemas/admin/settings.ts';

export default async (
  templateIdentifier: string,
  data: z.infer<typeof adminSettingsEmailTemplateUpdateSchema>,
): Promise<void> => {
  await axiosInstance.put(
    `/api/admin/system/email/templates/${templateIdentifier}`,
    serializeForApi(adminSettingsEmailTemplateUpdateSchema, data),
  );
};

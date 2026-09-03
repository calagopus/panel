import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailTemplateUpdateSchema } from '@/lib/schemas/admin/settings.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  templateIdentifier: string,
  data: z.infer<typeof adminSettingsEmailTemplateUpdateSchema>,
): Promise<void> => {
  await axiosInstance.put(
    `/api/admin/system/email/templates/${templateIdentifier}`,
    serializeForApi(adminSettingsEmailTemplateUpdateSchema, data),
  );
};

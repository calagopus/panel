import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminSettingsEmailTemplatePreviewResultSchema,
  adminSettingsEmailTemplatePreviewSchema,
} from '@/lib/schemas/admin/settings.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  templateIdentifier: string,
  data: z.infer<typeof adminSettingsEmailTemplatePreviewSchema>,
): Promise<z.infer<typeof adminSettingsEmailTemplatePreviewResultSchema>> => {
  const { data: response } = await axiosInstance.post(
    `/api/admin/system/email/templates/${templateIdentifier}/preview`,
    serializeForApi(adminSettingsEmailTemplatePreviewSchema, data),
  );
  return parseFromApi(adminSettingsEmailTemplatePreviewResultSchema, response);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailVariableCreateSchema } from '@/lib/schemas/admin/settings.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';
import { emailVariablesUrl } from './url.ts';

export default async (
  templateIdentifier: string | null,
  data: z.infer<typeof adminSettingsEmailVariableCreateSchema>,
): Promise<void> => {
  await axiosInstance.post(
    emailVariablesUrl(templateIdentifier),
    serializeForApi(adminSettingsEmailVariableCreateSchema, data),
  );
};

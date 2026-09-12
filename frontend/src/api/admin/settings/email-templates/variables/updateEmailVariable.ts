import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailVariableUpdateSchema } from '@/lib/schemas/admin/settings.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';
import { emailVariablesUrl } from './url.ts';

export default async (
  templateIdentifier: string | null,
  name: string,
  data: z.infer<typeof adminSettingsEmailVariableUpdateSchema>,
): Promise<void> => {
  await axiosInstance.put(
    `${emailVariablesUrl(templateIdentifier)}/${name}`,
    serializeForApi(adminSettingsEmailVariableUpdateSchema, data),
  );
};

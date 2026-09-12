import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsEmailVariableSchema } from '@/lib/schemas/admin/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';
import { emailVariablesUrl } from './url.ts';

export default async (
  templateIdentifier: string | null,
): Promise<z.infer<typeof adminSettingsEmailVariableSchema>[]> => {
  const { data } = await axiosInstance.get(emailVariablesUrl(templateIdentifier));
  return data.email_variables.map((item: unknown) => parseFromApi(adminSettingsEmailVariableSchema, item));
};

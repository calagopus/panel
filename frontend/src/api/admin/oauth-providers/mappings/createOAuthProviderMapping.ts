import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminOAuthProviderMappingCreateSchema,
  adminOAuthProviderMappingSchema,
} from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  oauthProviderUuid: string,
  data: z.infer<typeof adminOAuthProviderMappingCreateSchema>,
): Promise<z.infer<typeof adminOAuthProviderMappingSchema>> => {
  const { data: response } = await axiosInstance.post(
    `/api/admin/oauth-providers/${oauthProviderUuid}/mappings`,
    transformKeysToSnakeCase(data),
  );
  return response.oauthMapping;
};

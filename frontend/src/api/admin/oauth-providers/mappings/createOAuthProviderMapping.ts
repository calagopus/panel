import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import {
  adminOAuthProviderMappingCreateSchema,
  adminOAuthProviderMappingSchema,
} from '@/lib/schemas/admin/oauthProviders.ts';

export default async (
  oauthProviderUuid: string,
  data: z.infer<typeof adminOAuthProviderMappingCreateSchema>,
): Promise<z.infer<typeof adminOAuthProviderMappingSchema>> => {
  const { data: response } = await axiosInstance.post(
    `/api/admin/oauth-providers/${oauthProviderUuid}/mappings`,
    serializeForApi(adminOAuthProviderMappingCreateSchema, data),
  );
  return parseFromApi(adminOAuthProviderMappingSchema, response.oauth_mapping);
};

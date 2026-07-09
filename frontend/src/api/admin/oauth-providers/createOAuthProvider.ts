import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default async (
  oauthProviderData: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<z.infer<typeof adminOAuthProviderSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/oauth-providers',
    serializeForApi(adminOAuthProviderUpdateSchema, oauthProviderData),
  );
  return parseFromApi(adminOAuthProviderSchema, data.oauth_provider);
};

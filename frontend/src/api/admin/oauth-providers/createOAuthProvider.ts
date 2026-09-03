import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  oauthProviderData: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<z.infer<typeof adminOAuthProviderSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/oauth-providers',
    serializeForApi(
      adminOAuthProviderUpdateSchema,
      oauthProviderData,
      formExtensionSchemas('admin.oAuthProviders.createOrUpdate'),
    ),
  );
  return parseFromApi(adminOAuthProviderSchema, data.oauth_provider);
};

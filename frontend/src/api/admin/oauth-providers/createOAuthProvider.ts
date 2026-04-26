import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  oauthProviderData: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<z.infer<typeof adminOAuthProviderSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/oauth-providers', transformKeysToSnakeCase(oauthProviderData));
  return data.oauthProvider;
};

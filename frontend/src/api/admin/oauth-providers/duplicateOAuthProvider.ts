import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default async (oauthProviderUuid: string, name: string): Promise<z.infer<typeof adminOAuthProviderSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/oauth-providers/${oauthProviderUuid}/duplicate`, { name });
  return parseFromApi(adminOAuthProviderSchema, data.oauth_provider);
};

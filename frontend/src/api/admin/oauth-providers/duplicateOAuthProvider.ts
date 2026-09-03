import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (oauthProviderUuid: string, name: string): Promise<z.infer<typeof adminOAuthProviderSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/oauth-providers/${oauthProviderUuid}/duplicate`, { name });
  return parseFromApi(adminOAuthProviderSchema, data.oauth_provider);
};

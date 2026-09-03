import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthUserLinkSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  oauthProviderUuid: string,
  identifier: string,
): Promise<z.infer<typeof adminOAuthUserLinkSchema>> => {
  const { data } = await axiosInstance.get(
    `/api/admin/oauth-providers/${oauthProviderUuid}/users/identifier/${encodeURIComponent(identifier)}`,
  );
  return parseFromApi(adminOAuthUserLinkSchema, data.user_oauth_link);
};

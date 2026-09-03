import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthUserLinkSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  oauthProviderUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminOAuthUserLinkSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/oauth-providers/${oauthProviderUuid}/users`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminOAuthUserLinkSchema, data.user_oauth_links);
};

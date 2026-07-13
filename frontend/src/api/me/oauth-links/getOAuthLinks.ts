import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';

export default async (page: number): Promise<Pagination<z.infer<typeof userOAuthLinkSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/oauth-links', {
    params: { page },
  });
  return parsePaginationFromApi(userOAuthLinkSchema, data.oauth_links);
};

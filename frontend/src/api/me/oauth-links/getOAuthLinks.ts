import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';

export default async (page: number): Promise<Pagination<z.infer<typeof userOAuthLinkSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/oauth-links', {
    params: { page },
  });
  return data.oauthLinks;
};

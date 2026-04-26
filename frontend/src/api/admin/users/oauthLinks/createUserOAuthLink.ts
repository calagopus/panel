import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUserOAuthLinkSchema } from '@/lib/schemas/admin/users.ts';

export default async (
  userUuid: string,
  oauthProviderUuid: string,
  identifier: string,
): Promise<z.infer<typeof adminUserOAuthLinkSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/users/${userUuid}/oauth-links`, {
    oauth_provider_uuid: oauthProviderUuid,
    identifier,
  });
  return data.oauthLink;
};

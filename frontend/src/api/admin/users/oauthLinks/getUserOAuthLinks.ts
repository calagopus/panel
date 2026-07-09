import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminUserOAuthLinkSchema } from '@/lib/schemas/admin/users.ts';

export default async (
  userUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminUserOAuthLinkSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/users/${userUuid}/oauth-links`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminUserOAuthLinkSchema, data.oauth_links);
};

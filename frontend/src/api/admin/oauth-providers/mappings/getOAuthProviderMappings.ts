import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderMappingSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default async (
  oauthProviderUuid: string,
  page: number,
): Promise<Pagination<z.infer<typeof adminOAuthProviderMappingSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/oauth-providers/${oauthProviderUuid}/mappings`, {
    params: { page },
  });
  return data.oauthMappings;
};

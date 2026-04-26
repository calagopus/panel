import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  oauthProviderUuid: string,
  data: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/admin/oauth-providers/${oauthProviderUuid}`, transformKeysToSnakeCase(data));
};

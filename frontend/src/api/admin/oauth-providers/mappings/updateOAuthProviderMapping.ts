import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderMappingCreateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  oauthProviderUuid: string,
  mappingUuid: string,
  data: z.infer<typeof adminOAuthProviderMappingCreateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/oauth-providers/${oauthProviderUuid}/mappings/${mappingUuid}`,
    transformKeysToSnakeCase(data),
  );
};

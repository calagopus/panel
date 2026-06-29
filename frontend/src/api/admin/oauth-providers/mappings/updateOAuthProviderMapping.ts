import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminOAuthProviderMappingCreateSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default async (
  oauthProviderUuid: string,
  mappingUuid: string,
  data: z.infer<typeof adminOAuthProviderMappingCreateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/oauth-providers/${oauthProviderUuid}/mappings/${mappingUuid}`,
    serializeForApi(adminOAuthProviderMappingCreateSchema, data),
  );
};

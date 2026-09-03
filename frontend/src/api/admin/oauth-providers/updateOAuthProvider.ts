import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  oauthProviderUuid: string,
  data: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/oauth-providers/${oauthProviderUuid}`,
    serializeForApi(adminOAuthProviderUpdateSchema, data, formExtensionSchemas('admin.oAuthProviders.createOrUpdate')),
  );
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/api-transform.ts';
import { adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';

export default async (
  oauthProviderUuid: string,
  data: z.infer<typeof adminOAuthProviderUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/oauth-providers/${oauthProviderUuid}`,
    serializeForApi(adminOAuthProviderUpdateSchema, data, formExtensionSchemas('admin.oAuthProviders.createOrUpdate')),
  );
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (apiKeyUuid: string, data: Partial<z.infer<typeof userApiKeyUpdateSchema>>): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/account/api-keys/${apiKeyUuid}`,
    serializeForApi(userApiKeyUpdateSchema, data as z.infer<typeof userApiKeyUpdateSchema>),
  );
};

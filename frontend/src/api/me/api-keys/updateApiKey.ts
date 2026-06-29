import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';

export default async (apiKeyUuid: string, data: z.infer<typeof userApiKeyUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/account/api-keys/${apiKeyUuid}`,
    serializeForApi(userApiKeyUpdateSchema, data),
  );
};

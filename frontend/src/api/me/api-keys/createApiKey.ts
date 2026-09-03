import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userApiKeySchema, userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

const createApiKeyResponseSchema = z.object({
  apiKey: userApiKeySchema,
  key: z.string(),
});

export default async (
  keyData: z.infer<typeof userApiKeyUpdateSchema>,
): Promise<z.infer<typeof createApiKeyResponseSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/api-keys',
    serializeForApi(userApiKeyUpdateSchema, keyData),
  );
  return parseFromApi(createApiKeyResponseSchema, data);
};

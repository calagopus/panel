import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userApiKeySchema, userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Response {
  apiKey: z.infer<typeof userApiKeySchema>;
  key: string;
}

export default async (keyData: z.infer<typeof userApiKeyUpdateSchema>): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/client/account/api-keys', {
    ...transformKeysToSnakeCase(keyData),
    expires: keyData.expires ? keyData.expires.toISOString() : null,
  });
  return data;
};

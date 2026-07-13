import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userApiKeySchema, userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';

interface Response {
  apiKey: z.infer<typeof userApiKeySchema>;
  key: string;
}

export default async (keyData: z.infer<typeof userApiKeyUpdateSchema>): Promise<Response> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/api-keys',
    serializeForApi(userApiKeyUpdateSchema, keyData),
  );
  return data;
};

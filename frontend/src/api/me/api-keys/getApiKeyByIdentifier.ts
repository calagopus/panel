import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (identifier: string): Promise<z.infer<typeof userApiKeySchema>> => {
  const { data } = await axiosInstance.get(`/api/client/account/api-keys/identifier/${identifier}`);
  return parseFromApi(userApiKeySchema, data.api_key);
};

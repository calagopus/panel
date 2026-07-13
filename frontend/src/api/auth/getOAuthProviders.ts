import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';

export default async (): Promise<z.infer<typeof oAuthProviderSchema>[]> => {
  const { data } = await axiosInstance.get('/api/auth/oauth');
  return data.oauth_providers.map((item: unknown) => parseFromApi(oAuthProviderSchema, item));
};

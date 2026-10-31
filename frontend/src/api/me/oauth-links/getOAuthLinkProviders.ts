import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof oAuthProviderSchema>[]> => {
  const { data } = await axiosInstance.get('/api/client/account/oauth-links/providers');
  return data.oauth_providers.map((item: unknown) => parseFromApi(oAuthProviderSchema, item));
};

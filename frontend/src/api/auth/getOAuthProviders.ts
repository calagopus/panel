import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';

export default async (): Promise<z.infer<typeof oAuthProviderSchema>[]> => {
  const { data } = await axiosInstance.get('/api/auth/oauth');
  return data.oauthProviders;
};

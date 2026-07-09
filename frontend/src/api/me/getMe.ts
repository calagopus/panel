import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

export default async (): Promise<z.infer<typeof fullUserSchema>> => {
  const { data } = await axiosInstance.get('/api/client/account');
  return parseFromApi(fullUserSchema, data.user);
};

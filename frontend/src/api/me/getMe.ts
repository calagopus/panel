import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

export default async (): Promise<z.infer<typeof fullUserSchema>> => {
  const { data } = await axiosInstance.get('/api/client/account');
  return data.user;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

interface Data {
  code: string;
  method?: 'totp' | 'email';
  confirmation_token: string;
}

interface Response {
  user: z.infer<typeof fullUserSchema>;
}

export default async ({ code, method, confirmation_token }: Data): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/login/checkpoint', { code, method, confirmation_token });
  return { ...data, user: parseFromApi(fullUserSchema, data.user) };
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

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

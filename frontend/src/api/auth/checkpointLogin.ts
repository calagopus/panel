import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

interface Data {
  code: string;
  confirmation_token: string;
}

interface Response {
  user: z.infer<typeof fullUserSchema>;
}

export default async ({ code, confirmation_token }: Data): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/login/checkpoint', { code, confirmation_token });
  return data;
};

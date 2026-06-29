import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { authRegisterSchema } from '@/lib/schemas/auth.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data extends z.infer<typeof authRegisterSchema> {
  captcha?: string | null;
}

interface Response {
  user: z.infer<typeof fullUserSchema>;
}

export default async (registerData: Data): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/register', transformKeysToSnakeCase(registerData));
  return data;
};

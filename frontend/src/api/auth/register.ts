import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { authRegisterSchema } from '@/lib/schemas/auth.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

const registerWithCaptchaSchema = authRegisterSchema.extend({ captcha: z.string().nullable().optional() });

interface Response {
  user: z.infer<typeof fullUserSchema>;
}

export default async (registerData: z.infer<typeof registerWithCaptchaSchema>): Promise<Response> => {
  const { data } = await axiosInstance.post(
    '/api/auth/register',
    serializeForApi(registerWithCaptchaSchema, registerData),
  );
  return data;
};

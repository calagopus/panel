import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { authForgotPasswordSchema } from '@/lib/schemas/auth.ts';

export default async (data: z.infer<typeof authForgotPasswordSchema>, captcha: string | null): Promise<void> => {
  await axiosInstance.post('/api/auth/password/forgot', { ...data, captcha });
};

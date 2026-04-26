import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { authResetPasswordSchema } from '@/lib/schemas/auth.ts';

export default async (token: string, data: z.infer<typeof authResetPasswordSchema>): Promise<void> => {
  await axiosInstance.post('/api/auth/password/reset', { token, new_password: data.password });
};

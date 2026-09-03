import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const verifyEmailResponseSchema = z.object({
  userUuid: z.string(),
  email: z.string(),
});

export default async (token: string): Promise<z.infer<typeof verifyEmailResponseSchema>> => {
  const { data } = await axiosInstance.post('/api/auth/email/verify', { token });
  return parseFromApi(verifyEmailResponseSchema, data);
};

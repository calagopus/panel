import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

const updatePasswordSchema = z.object({
  password: z.string(),
  newPassword: z.string(),
});

export default async (data: z.infer<typeof updatePasswordSchema>): Promise<void> => {
  await axiosInstance.put('/api/client/account/password', serializeForApi(updatePasswordSchema, data));
};

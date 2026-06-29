import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  userData: z.infer<typeof adminUserUpdateSchema>,
): Promise<z.infer<typeof adminFullUserSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/users', transformKeysToSnakeCase(userData));
  return data.user;
};

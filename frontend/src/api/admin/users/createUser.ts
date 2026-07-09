import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';

export default async (
  userData: z.infer<typeof adminUserUpdateSchema>,
): Promise<z.infer<typeof adminFullUserSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/users', serializeForApi(adminUserUpdateSchema, userData));
  return parseFromApi(adminFullUserSchema, data.user);
};

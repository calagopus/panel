import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { roleSchema } from '@/lib/schemas/user.ts';

export default async (roleData: z.infer<typeof adminRoleUpdateSchema>): Promise<z.infer<typeof roleSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/roles', serializeForApi(adminRoleUpdateSchema, roleData));
  return parseFromApi(roleSchema, data.role);
};

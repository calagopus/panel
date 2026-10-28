import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminRoleCountsSchema } from '@/lib/schemas/admin/roles.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminRoleCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/roles/counts');
  return parseFromApi(adminRoleCountsSchema, data.roles);
};

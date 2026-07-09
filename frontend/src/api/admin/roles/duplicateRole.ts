import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { roleSchema } from '@/lib/schemas/user.ts';

export default async (roleUuid: string, name: string): Promise<z.infer<typeof roleSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/roles/${roleUuid}/duplicate`, { name });
  return parseFromApi(roleSchema, data.role);
};

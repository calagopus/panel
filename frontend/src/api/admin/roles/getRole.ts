import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { roleSchema } from '@/lib/schemas/user.ts';

export default async (roleUuid: string): Promise<z.infer<typeof roleSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/roles/${roleUuid}`);
  return parseFromApi(roleSchema, data.role);
};

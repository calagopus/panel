import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (roleUuid: string): Promise<z.infer<typeof roleSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/roles/${roleUuid}`);
  return parseFromApi(roleSchema, data.role);
};

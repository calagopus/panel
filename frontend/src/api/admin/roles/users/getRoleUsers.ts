import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  roleUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminFullUserSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/roles/${roleUuid}/users`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminFullUserSchema, data.users);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';

export default async (
  roleUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof fullUserSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/roles/${roleUuid}/users`, {
    params: { page, search },
  });
  return data.users;
};

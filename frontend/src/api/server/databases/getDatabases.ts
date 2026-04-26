import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverDatabaseSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases`, {
    params: { page, search, include_password: true },
  });
  return data.databases;
};

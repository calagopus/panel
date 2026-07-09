import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export default async (
  nestUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nests/${nestUuid}/eggs`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminEggSchema, data.eggs);
};

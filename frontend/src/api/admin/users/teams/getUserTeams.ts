import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  userUuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof adminTeamSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/users/${userUuid}/teams`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(adminTeamSchema, data.teams);
};

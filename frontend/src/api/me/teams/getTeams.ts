import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof userTeamSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/teams', {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(userTeamSchema, data.teams);
};

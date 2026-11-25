import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamMemberSchema } from '@/lib/schemas/admin/teams.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof adminTeamMemberSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/teams/${teamUuid}/members`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(adminTeamMemberSchema, data.members);
};

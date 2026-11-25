import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamMemberSchema } from '@/lib/schemas/user/teams.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof userTeamMemberSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/subusers/team`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(userTeamMemberSchema, data.members);
};

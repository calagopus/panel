import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamPresetSchema } from '@/lib/schemas/user/teams.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  page: number,
  search?: string,
  perPage?: number,
): Promise<Pagination<z.infer<typeof userTeamPresetSchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/teams/${teamUuid}/presets`, {
    params: { page, per_page: perPage, search },
  });
  return parsePaginationFromApi(userTeamPresetSchema, data.presets);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (teamUuid: string): Promise<z.infer<typeof userTeamSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/teams/${teamUuid}`);
  return parseFromApi(userTeamSchema, data.team);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamCountsSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof userTeamCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/client/teams/counts');
  return parseFromApi(userTeamCountsSchema, data.teams);
};

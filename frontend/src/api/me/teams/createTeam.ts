import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamSchema, userTeamUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (teamData: z.infer<typeof userTeamUpdateSchema>): Promise<z.infer<typeof userTeamSchema>> => {
  const { data } = await axiosInstance.post('/api/client/teams', serializeForApi(userTeamUpdateSchema, teamData));
  return parseFromApi(userTeamSchema, data.team);
};

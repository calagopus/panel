import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamCountsSchema } from '@/lib/schemas/admin/teams.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminTeamCountsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/teams/counts');
  return parseFromApi(adminTeamCountsSchema, data.teams);
};

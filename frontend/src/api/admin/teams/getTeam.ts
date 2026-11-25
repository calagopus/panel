import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (teamUuid: string): Promise<z.infer<typeof adminTeamSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/teams/${teamUuid}`);
  return parseFromApi(adminTeamSchema, data.team);
};

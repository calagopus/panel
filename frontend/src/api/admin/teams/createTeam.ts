import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamCreateSchema, adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (teamData: z.infer<typeof adminTeamCreateSchema>): Promise<z.infer<typeof adminTeamSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/teams',
    serializeForApi(adminTeamCreateSchema, teamData, formExtensionSchemas('admin.teams.createOrUpdate')),
  );
  return parseFromApi(adminTeamSchema, data.team);
};

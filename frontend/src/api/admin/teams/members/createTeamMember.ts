import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminTeamMemberCreateSchema, adminTeamMemberSchema } from '@/lib/schemas/admin/teams.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  memberData: z.infer<typeof adminTeamMemberCreateSchema>,
): Promise<z.infer<typeof adminTeamMemberSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/teams/${teamUuid}/members`,
    serializeForApi(adminTeamMemberCreateSchema, memberData),
  );
  return parseFromApi(adminTeamMemberSchema, data.member);
};

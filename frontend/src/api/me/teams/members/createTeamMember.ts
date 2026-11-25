import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamMemberCreateSchema, userTeamMemberSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

const createSchema = userTeamMemberCreateSchema.extend({
  captcha: z.string().nullable(),
});

export default async (
  teamUuid: string,
  memberData: z.infer<typeof createSchema>,
): Promise<z.infer<typeof userTeamMemberSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/teams/${teamUuid}/members`,
    serializeForApi(createSchema, memberData),
  );
  return parseFromApi(userTeamMemberSchema, data.member);
};

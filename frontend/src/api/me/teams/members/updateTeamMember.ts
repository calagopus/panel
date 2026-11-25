import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamMemberUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  userUuid: string,
  data: z.infer<typeof userTeamMemberUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/teams/${teamUuid}/members/${userUuid}`,
    serializeForApi(userTeamMemberUpdateSchema, data),
  );
};

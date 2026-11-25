import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (teamUuid: string, data: z.infer<typeof userTeamUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/teams/${teamUuid}`,
    serializeForApi(userTeamUpdateSchema, data, formExtensionSchemas('admin.teams.createOrUpdate')),
  );
};

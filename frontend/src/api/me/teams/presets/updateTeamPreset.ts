import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamPresetUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  presetUuid: string,
  data: z.infer<typeof userTeamPresetUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/teams/${teamUuid}/presets/${presetUuid}`,
    serializeForApi(userTeamPresetUpdateSchema, data),
  );
};

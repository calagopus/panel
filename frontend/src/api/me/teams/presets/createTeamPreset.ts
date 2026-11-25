import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamPresetSchema, userTeamPresetUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  presetData: z.infer<typeof userTeamPresetUpdateSchema>,
): Promise<z.infer<typeof userTeamPresetSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/teams/${teamUuid}/presets`,
    serializeForApi(userTeamPresetUpdateSchema, presetData),
  );
  return parseFromApi(userTeamPresetSchema, data.preset);
};

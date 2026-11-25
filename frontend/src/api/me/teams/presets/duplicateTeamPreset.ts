import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userTeamPresetSchema } from '@/lib/schemas/user/teams.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  teamUuid: string,
  presetUuid: string,
  name: string,
): Promise<z.infer<typeof userTeamPresetSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/teams/${teamUuid}/presets/${presetUuid}/duplicate`, { name });
  return parseFromApi(userTeamPresetSchema, data.preset);
};

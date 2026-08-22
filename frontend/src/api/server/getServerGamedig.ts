import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

export const gameDigResponseSchema = z.looseObject({
  enabled: z.boolean(),
  game: z.string().nullable(),
  online: z.boolean(),
  playersOnline: z.number().nullable(),
  playersMaximum: z.number().nullable(),
  map: z.string().nullable(),
  version: z.string().nullable(),
});

export type GameDigResponse = z.infer<typeof gameDigResponseSchema>;

export default async (uuid: string): Promise<GameDigResponse> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/gamedig`);
  return parseFromApi(gameDigResponseSchema, data.game_dig);
};

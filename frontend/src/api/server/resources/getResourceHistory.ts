import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverResourceHistorySchema } from '@/lib/schemas/server/server.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  start: Date,
  end: Date,
  points: number,
): Promise<z.infer<typeof serverResourceHistorySchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/resources/history`, {
    params: { start: start.toISOString(), end: end.toISOString(), points },
  });
  return parseFromApi(serverResourceHistorySchema, data.history);
};

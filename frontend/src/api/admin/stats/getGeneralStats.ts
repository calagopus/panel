import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const generalStatsSchema = z.object({
  users: z.number(),
  servers: z.number(),
  locations: z.number(),
  nodes: z.number(),
  nestEggs: z.number(),
  databaseHosts: z.number(),
  backupConfigurations: z.number(),
  roles: z.number(),
});

export type GeneralStats = z.infer<typeof generalStatsSchema>;

export default async (): Promise<GeneralStats> => {
  const { data } = await axiosInstance.get('/api/admin/stats/general');
  return parseFromApi(generalStatsSchema, data.stats);
};

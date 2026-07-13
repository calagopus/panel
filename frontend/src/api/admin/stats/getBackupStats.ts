import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

export const backupStatsSchema = z.object({
  total: z.number(),
  successful: z.number(),
  successfulBytes: z.number(),
  failed: z.number(),
  deleted: z.number(),
  deletedBytes: z.number(),
});

export const backupStatsByPeriodSchema = z.object({
  allTime: backupStatsSchema,
  today: backupStatsSchema,
  week: backupStatsSchema,
  month: backupStatsSchema,
});

export type BackupStats = z.infer<typeof backupStatsSchema>;

export default async (): Promise<z.infer<typeof backupStatsByPeriodSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/stats/backups');
  return parseFromApi(backupStatsByPeriodSchema, data);
};

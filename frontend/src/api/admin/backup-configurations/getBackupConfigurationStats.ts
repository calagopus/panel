import { z } from 'zod';
import { type BackupStats, backupStatsByPeriodSchema } from '@/api/admin/stats/getBackupStats.ts';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

export type { BackupStats };

export default async (backupConfigUuid: string): Promise<z.infer<typeof backupStatsByPeriodSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/backup-configurations/${backupConfigUuid}/stats`);
  return parseFromApi(backupStatsByPeriodSchema, data);
};

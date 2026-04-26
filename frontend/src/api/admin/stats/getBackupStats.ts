import { axiosInstance } from '@/api/axios.ts';

export interface BackupStats {
  total: number;
  successful: number;
  successfulBytes: number;
  failed: number;
  deleted: number;
  deletedBytes: number;
}

export default async (): Promise<Record<'allTime' | 'today' | 'week' | 'month', BackupStats>> => {
  const { data } = await axiosInstance.get('/api/admin/stats/backups');
  return data;
};

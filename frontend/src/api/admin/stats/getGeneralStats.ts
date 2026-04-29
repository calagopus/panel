import { axiosInstance } from '@/api/axios.ts';

export interface GeneralStats {
  users: number;
  servers: number;
  locations: number;
  nodes: number;
  nestEggs: number;
  databaseHosts: number;
  backupConfigurations: number;
  roles: number;
}

export default async (): Promise<GeneralStats> => {
  const { data } = await axiosInstance.get('/api/admin/stats/general');
  return data.stats;
};

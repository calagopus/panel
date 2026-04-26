import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default async (hostUuid: string): Promise<z.infer<typeof adminDatabaseHostSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/database-hosts/${hostUuid}`);
  return data.databaseHost;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupUsageSchema } from '@/lib/schemas/server/backups.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverBackupUsageSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/backups/usage`);
  return parseFromApi(serverBackupUsageSchema, data.usage);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstancePowerAction } from '@/lib/schemas/server/databaseInstances.ts';

export type DatabaseInstancePowerAction = z.infer<typeof serverDatabaseInstancePowerAction>;

export default async (uuid: string, instanceUuid: string, action: DatabaseInstancePowerAction): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/databases/instances/${instanceUuid}/power`, { action });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverBackupGroupUpdateSchema } from '@/lib/schemas/server/backups.ts';

export default async (
  serverUuid: string,
  groupUuid: string,
  data: z.infer<typeof serverBackupGroupUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${serverUuid}/backups/groups/${groupUuid}`,
    serializeForApi(serverBackupGroupUpdateSchema, data),
  );
};

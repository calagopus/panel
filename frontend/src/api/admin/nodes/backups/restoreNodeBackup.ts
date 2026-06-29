import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (
  nodeUuid: string,
  backupUuid: string,
  data: { serverUuid: string; truncateDirectory: boolean; restoreStartup: boolean },
): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/restore`,
    serializeForApi(
      z.object({ serverUuid: z.string(), truncateDirectory: z.boolean(), restoreStartup: z.boolean() }),
      data,
    ),
  );
};

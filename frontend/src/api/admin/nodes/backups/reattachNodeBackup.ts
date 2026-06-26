import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (nodeUuid: string, backupUuid: string, data: { serverUuid: string }): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/reattach`,
    serializeForApi(z.object({ serverUuid: z.string() }), data),
  );
};

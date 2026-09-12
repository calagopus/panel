import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string, backupUuid: string, data: { databaseInstanceUuid: string }): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/reassign`,
    serializeForApi(z.object({ databaseInstanceUuid: z.string() }), data),
  );
};

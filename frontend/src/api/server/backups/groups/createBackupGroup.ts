import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { serverBackupGroupCreateSchema, serverBackupGroupSchema } from '@/lib/schemas/server/backups.ts';

export default async (
  uuid: string,
  data: z.infer<typeof serverBackupGroupCreateSchema>,
): Promise<z.infer<typeof serverBackupGroupSchema>> => {
  const { data: response } = await axiosInstance.post(
    `/api/client/servers/${uuid}/backups/groups`,
    serializeForApi(serverBackupGroupCreateSchema, data),
  );
  return parseFromApi(serverBackupGroupSchema, response.backup_group);
};

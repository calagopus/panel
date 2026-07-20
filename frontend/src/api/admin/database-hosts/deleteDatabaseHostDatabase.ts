import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (
  hostUuid: string,
  databaseUuid: string,
  data: { force: boolean } = { force: false },
): Promise<void> => {
  await axiosInstance.delete(`/api/admin/database-hosts/${hostUuid}/databases/${databaseUuid}`, {
    data: serializeForApi(z.object({ force: z.boolean() }), data),
  });
};

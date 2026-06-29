import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (serverUuid: string, data: { force: boolean; deleteBackups: boolean }): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${serverUuid}`, {
    data: serializeForApi(z.object({ force: z.boolean(), deleteBackups: z.boolean() }), data),
  });
};

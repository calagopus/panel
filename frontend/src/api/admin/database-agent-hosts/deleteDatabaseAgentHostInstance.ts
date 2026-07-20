import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (
  hostUuid: string,
  instanceUuid: string,
  data: { force: boolean } = { force: false },
): Promise<void> => {
  await axiosInstance.delete(`/api/admin/database-agent-hosts/${hostUuid}/instances/${instanceUuid}`, {
    data: serializeForApi(z.object({ force: z.boolean() }), data),
  });
};

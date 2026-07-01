import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (nestUuid: string, data: { deleteEggs: boolean }): Promise<void> => {
  await axiosInstance.delete(`/api/admin/nests/${nestUuid}`, {
    data: serializeForApi(z.object({ deleteEggs: z.boolean() }), data),
  });
};

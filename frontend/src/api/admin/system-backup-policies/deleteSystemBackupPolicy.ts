import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

export default async (policyUuid: string, data: { deleteBackups: boolean }): Promise<void> => {
  await axiosInstance.delete(`/api/admin/system-backup-policies/${policyUuid}`, {
    data: serializeForApi(z.object({ deleteBackups: z.boolean() }), data),
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';

export default async (nestUuid: string, data: z.infer<typeof adminNestUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nests/${nestUuid}`, serializeForApi(adminNestUpdateSchema, data));
};

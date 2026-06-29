import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (nodeUuid: string, data: z.infer<typeof adminNodeUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nodes/${nodeUuid}`, transformKeysToSnakeCase(data));
};

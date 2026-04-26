import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (mountUuid: string, data: z.infer<typeof adminMountUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/mounts/${mountUuid}`, transformKeysToSnakeCase(data));
};

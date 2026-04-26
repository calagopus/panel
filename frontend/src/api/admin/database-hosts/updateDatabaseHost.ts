import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseHostUpdateSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (hostUuid: string, data: z.infer<typeof adminDatabaseHostUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/database-hosts/${hostUuid}`, transformKeysToSnakeCase(data));
};

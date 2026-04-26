import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (locationUuid: string, data: z.infer<typeof adminLocationUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/locations/${locationUuid}`, transformKeysToSnakeCase(data));
};

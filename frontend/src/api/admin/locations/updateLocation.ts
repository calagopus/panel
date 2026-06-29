import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminLocationUpdateSchema } from '@/lib/schemas/admin/locations.ts';

export default async (locationUuid: string, data: z.infer<typeof adminLocationUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/locations/${locationUuid}`, serializeForApi(adminLocationUpdateSchema, data));
};

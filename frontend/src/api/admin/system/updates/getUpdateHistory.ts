import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUpdateHistorySchema } from '@/lib/schemas/admin/system.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminUpdateHistorySchema> | null> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates/history');
  return data.version_history ? parseFromApi(adminUpdateHistorySchema, data.version_history) : null;
};

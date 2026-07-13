import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminUpdateHistorySchema } from '@/lib/schemas/admin/system.ts';

export default async (): Promise<z.infer<typeof adminUpdateHistorySchema> | null> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates/history');
  return data.version_history ? parseFromApi(adminUpdateHistorySchema, data.version_history) : null;
};

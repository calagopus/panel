import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';

export default async (nestData: z.infer<typeof adminNestUpdateSchema>): Promise<z.infer<typeof adminNestSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/nests', serializeForApi(adminNestUpdateSchema, nestData));
  return parseFromApi(adminNestSchema, data.nest);
};

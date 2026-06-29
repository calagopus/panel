import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (nestData: z.infer<typeof adminNestUpdateSchema>): Promise<z.infer<typeof adminNestSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/nests', transformKeysToSnakeCase(nestData));
  return data.nest;
};

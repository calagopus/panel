import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

const nestWithEggsSchema = z.object({
  nest: adminNestSchema,
  eggs: z.array(adminEggSchema),
});

export default async (): Promise<z.infer<typeof nestWithEggsSchema>[]> => {
  const { data } = await axiosInstance.get('/api/admin/nests/eggs');
  return data.nests.map((item: unknown) => parseFromApi(nestWithEggsSchema, item));
};

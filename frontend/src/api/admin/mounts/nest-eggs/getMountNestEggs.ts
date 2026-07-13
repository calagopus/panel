import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

const nestEggMountSchema = z.object({
  nest: adminNestSchema,
  nestEgg: adminEggSchema,
  created: z.coerce.date(),
});

export default async (
  mountUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof nestEggMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}/nest-eggs`, {
    params: { page, search },
  });
  return parsePaginationFromApi(nestEggMountSchema, data.nest_egg_mounts);
};

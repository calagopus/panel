import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const extensionRebuildSchema = z.object({
  buildId: z.number(),
});

export default async (force: boolean): Promise<z.infer<typeof extensionRebuildSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/extensions/manage/rebuild', undefined, {
    params: { force },
  });
  return parseFromApi(extensionRebuildSchema, data);
};

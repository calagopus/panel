import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const extensionRebuildCancelSchema = z.object({
  buildId: z.number(),
});

export default async (buildId: number | null): Promise<z.infer<typeof extensionRebuildCancelSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/extensions/manage/rebuild/cancel', undefined, {
    params: { build_id: buildId ?? undefined },
  });
  return parseFromApi(extensionRebuildCancelSchema, data);
};

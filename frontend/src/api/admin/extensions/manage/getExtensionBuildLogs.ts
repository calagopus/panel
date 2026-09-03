import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const extensionBuildLogChunkSchema = z.object({
  offset: z.number(),
  data: z.string(),
  eof: z.boolean(),
});

export type ExtensionBuildLogChunk = z.infer<typeof extensionBuildLogChunkSchema>;

export default async (buildId: number | null, fromOffset: number): Promise<ExtensionBuildLogChunk> => {
  const { data } = await axiosInstance.get('/api/admin/extensions/manage/logs', {
    params: { build_id: buildId ?? undefined, from_offset: fromOffset },
  });
  return parseFromApi(extensionBuildLogChunkSchema, data);
};

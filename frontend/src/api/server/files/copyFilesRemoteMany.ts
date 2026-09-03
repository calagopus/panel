import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFilesCopyRemoteManyResultSchema, serverFilesCopyRemoteManySchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

const copyFileSchema = z.object({ from: z.string(), to: z.string() });

export default async (
  uuid: string,
  copyData: z.infer<typeof serverFilesCopyRemoteManySchema> & { root: string; files: z.infer<typeof copyFileSchema>[] },
): Promise<z.infer<typeof serverFilesCopyRemoteManyResultSchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/copy-remote-many`,
    serializeForApi(
      serverFilesCopyRemoteManySchema.extend({ root: z.string(), files: z.array(copyFileSchema) }),
      copyData,
    ),
  );
  return data.results.map((item: unknown) => parseFromApi(serverFilesCopyRemoteManyResultSchema, item));
};

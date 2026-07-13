import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverFilesCopyRemoteSchema } from '@/lib/schemas/server/files.ts';

export default async (
  uuid: string,
  copyData: z.infer<typeof serverFilesCopyRemoteSchema> & { root: string; files: string[] },
): Promise<string> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/copy-remote`,
    serializeForApi(serverFilesCopyRemoteSchema.extend({ root: z.string(), files: z.array(z.string()) }), copyData),
  );
  return data.identifier;
};

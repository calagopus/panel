import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFilesCopyRemoteSchema } from '@/lib/schemas/server/files.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

type Data = z.infer<typeof serverFilesCopyRemoteSchema> & {
  root: string;
  files: string[];
};

export default async (uuid: string, copyData: Data): Promise<string> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/copy-remote`,
    transformKeysToSnakeCase(copyData),
  );
  return data.identifier;
};

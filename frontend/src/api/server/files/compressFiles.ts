import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFilesArchiveCreateSchema } from '@/lib/schemas/server/files.ts';

type Data = z.infer<typeof serverFilesArchiveCreateSchema> & {
  root: string;
  files: string[];
};

export default async (uuid: string, compressData: Data): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/compress`, compressData, {
    timeout: 60000,
    timeoutErrorMessage: 'It looks like this archive is taking a long time to generate. It will appear once completed.',
  });
  return data.identifier;
};

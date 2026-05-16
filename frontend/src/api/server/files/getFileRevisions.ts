import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFileRevisionSchema } from '@/lib/schemas/server/files.ts';

export default async (uuid: string, file: string): Promise<z.infer<typeof serverFileRevisionSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/revisions`, {
    params: { file },
  });
  return data.revisions;
};

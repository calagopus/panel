import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';

export default async (uuid: string, directory: string): Promise<z.infer<typeof serverDirectoryEntrySchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/largest-directories`, {
    params: { directory },
  });
  return data.largest_directories.map((item: unknown) => parseFromApi(serverDirectoryEntrySchema, item));
};

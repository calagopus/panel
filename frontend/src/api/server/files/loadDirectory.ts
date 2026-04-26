import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema, serverDirectorySortingModeSchema } from '@/lib/schemas/server/files.ts';

export interface DirectoryResponse {
  isFilesystemWritable: boolean;
  isFilesystemFast: boolean;
  entries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>;
}

export default async (
  uuid: string,
  directory: string,
  page: number,
  sort: z.infer<typeof serverDirectorySortingModeSchema>,
): Promise<DirectoryResponse> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/list`, {
    params: { directory: directory ?? '/', page, per_page: 100, sort },
  });
  return data;
};

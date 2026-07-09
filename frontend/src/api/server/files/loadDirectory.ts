import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { serverDirectoryEntrySchema, serverDirectorySortingModeSchema } from '@/lib/schemas/server/files.ts';

export interface DirectoryResponse {
  isFilesystemPrimary: boolean;
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
  return {
    isFilesystemPrimary: data.is_filesystem_primary,
    isFilesystemWritable: data.is_filesystem_writable,
    isFilesystemFast: data.is_filesystem_fast,
    entries: parsePaginationFromApi(serverDirectoryEntrySchema, data.entries),
  };
};

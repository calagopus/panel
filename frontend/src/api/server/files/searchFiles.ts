import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema, serverFilesSearchSchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

const searchFilesSchema = serverFilesSearchSchema.extend({ root: z.string() });

export default async (
  uuid: string,
  searchData: z.infer<typeof searchFilesSchema>,
): Promise<z.infer<typeof serverDirectoryEntrySchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/search`,
    serializeForApi(searchFilesSchema, searchData),
  );
  return data.entries.map((item: unknown) => parseFromApi(serverDirectoryEntrySchema, item));
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  root: string;
  pathFilter: {
    include: string[];
    exclude: string[];
    caseInsensitive: boolean;
  } | null;
  sizeFilter: {
    min: number;
    max: number;
  } | null;
  contentFilter: {
    query: string;
    maxSearchSize: number;
    includeUnmatched: boolean;
    caseInsensitive: boolean;
  } | null;
}

export default async (uuid: string, searchData: Data): Promise<z.infer<typeof serverDirectoryEntrySchema>[]> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/search`,
    transformKeysToSnakeCase(searchData),
  );
  return data.entries;
};

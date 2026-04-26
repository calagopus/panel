import { createSearchParams } from 'react-router';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';

export default async (
  uuid: string,
  root: string,
  paths: string[],
  isDirectory: boolean,
  archiveFormat: z.infer<typeof streamingArchiveFormat>,
): Promise<{ url: string }> => {
  const { data } = await axiosInstance.get(
    `/api/client/servers/${uuid}/files/download?${createSearchParams({
      root,
      files: paths,
      directory: isDirectory.toString(),
      archive_format: archiveFormat,
    })}`,
  );
  return data;
};

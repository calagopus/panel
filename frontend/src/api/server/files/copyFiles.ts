import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

interface Props {
  uuid: string;
  root: string;
  files: {
    from: string;
    to: string;
  }[];
  overwrite?: boolean;
}

interface Result {
  identifier: string;
  skipped: z.infer<typeof serverDirectoryEntrySchema>[];
}

export default async ({ uuid, root, files, overwrite = false }: Props): Promise<Result> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/copy-many`, { root, files, overwrite });
  return {
    identifier: data.identifier,
    skipped: (data.skipped ?? []).map((entry: unknown) => parseFromApi(serverDirectoryEntrySchema, entry)),
  };
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema, serverTrashRestoredFileSchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

interface Props {
  uuid: string;
  entry: string;
  files: {
    from: string;
    to?: string;
  }[];
  overwrite?: boolean;
}

interface Result {
  restored: z.infer<typeof serverTrashRestoredFileSchema>[];
  conflicts: {
    from: string;
    destination: z.infer<typeof serverDirectoryEntrySchema>;
  }[];
}

export default async ({ uuid, entry, files, overwrite = false }: Props): Promise<Result> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/trash/${entry}/restore`, {
    files,
    overwrite,
  });
  return {
    restored: data.restored.map((file: unknown) => parseFromApi(serverTrashRestoredFileSchema, file)),
    conflicts: data.conflicts.map((conflict: { from: string; destination: unknown }) => ({
      from: conflict.from,
      destination: parseFromApi(serverDirectoryEntrySchema, conflict.destination),
    })),
  };
};

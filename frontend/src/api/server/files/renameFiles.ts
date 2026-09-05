import { join } from 'pathe';
import { axiosInstance } from '@/api/axios.ts';
import { notifyFileRenames, validateFileRenames } from '@/lib/files/fileRenames.ts';

interface Props {
  uuid: string;
  root: string;
  files: {
    from: string;
    to: string;
  }[];
}

export default async ({ uuid, root, files }: Props): Promise<{ renamed: number }> => {
  const normalized = files.map((file) => ({ from: join(root, file.from), to: join(root, file.to) }));
  validateFileRenames(uuid, normalized);
  const { data } = await axiosInstance.put(`/api/client/servers/${uuid}/files/rename`, { root, files });
  await notifyFileRenames(uuid, {
    files: normalized,
    renamed: data.renamed,
  });
  return data;
};

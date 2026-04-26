import { axiosInstance } from '@/api/axios.ts';

interface Props {
  uuid: string;
  root: string;
  files: {
    from: string;
    to: string;
  }[];
}

export default async ({ uuid, root, files }: Props): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/copy-many`, { root, files });
  return data.identifier;
};

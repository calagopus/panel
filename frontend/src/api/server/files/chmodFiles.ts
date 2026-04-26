import { axiosInstance } from '@/api/axios.ts';

interface Props {
  uuid: string;
  root: string;
  files: {
    file: string;
    mode: string;
  }[];
}

export default async ({ uuid, root, files }: Props): Promise<{ updated: number }> => {
  const { data } = await axiosInstance.put(`/api/client/servers/${uuid}/files/chmod`, { root, files });
  return data;
};

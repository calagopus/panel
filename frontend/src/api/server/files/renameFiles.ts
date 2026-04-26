import { axiosInstance } from '@/api/axios.ts';

interface Props {
  uuid: string;
  root: string;
  files: {
    from: string;
    to: string;
  }[];
}

export default async ({ uuid, root, files }: Props): Promise<{ renamed: number }> => {
  const { data } = await axiosInstance.put(`/api/client/servers/${uuid}/files/rename`, { root, files });
  return data;
};

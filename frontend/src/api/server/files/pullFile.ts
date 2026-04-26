import { axiosInstance } from '@/api/axios.ts';

interface Data {
  root: string;
  url: string;
  name: string | null;
}

export default async (uuid: string, pullData: Data): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/pull`, pullData);
  return data.identifier;
};

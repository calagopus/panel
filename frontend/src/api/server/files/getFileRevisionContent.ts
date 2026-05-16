import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, revisionId: number): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/revisions/${revisionId}`, {
    responseType: 'text',
  });
  return data;
};

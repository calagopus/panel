import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, root: string, file: string): Promise<string> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/files/decompress`,
    { root, file },
    {
      timeout: 60000,
      timeoutErrorMessage:
        'It looks like this archive is taking a long time to be unarchived. Once completed the unarchived files will appear.',
    },
  );
  return data.identifier;
};

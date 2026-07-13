import { axiosInstance } from '@/api/axios.ts';

export default async (
  uuid: string,
  instanceUuid: string,
  databaseUuid: string,
  file: File,
  wipe: boolean,
): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/databases/${databaseUuid}/import`,
    file,
    {
      params: { wipe },
      headers: { 'Content-Type': 'application/octet-stream' },
    },
  );
};

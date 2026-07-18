import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, instanceUuid: string): Promise<{ blob: Blob; filename: string | null }> => {
  const { data, headers } = await axiosInstance.get(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/export`,
    { responseType: 'blob' },
  );

  const disposition = headers['content-disposition'];
  const match = typeof disposition === 'string' ? disposition.match(/filename="?([^"]+)"?/) : null;

  return { blob: data, filename: match?.[1] ?? null };
};

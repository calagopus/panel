import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { patchFormat } from '@/lib/schemas/server/files.ts';

interface Data {
  root: string;
  format: z.infer<typeof patchFormat>;
  source: { type: 'inline'; data: string } | { type: 'file'; path: string };
  file: string | null;
  strip: number;
}

export default async (uuid: string, patchData: Data): Promise<number> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/patch`, patchData);
  return data.patched;
};

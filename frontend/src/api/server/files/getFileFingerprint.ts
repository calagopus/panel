import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fingerprintAlgorithm } from '@/lib/schemas/server/files.ts';

export default async (uuid: string, file: string, algorithm: z.infer<typeof fingerprintAlgorithm>): Promise<string> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/fingerprint`, {
    params: {
      file,
      algorithm,
    },
  });
  return data.fingerprint;
};

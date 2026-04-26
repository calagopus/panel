import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { databaseHostSchema } from '@/lib/schemas/generic.ts';

export default async (uuid: string): Promise<z.infer<typeof databaseHostSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/hosts`);
  return data.databaseHosts;
};

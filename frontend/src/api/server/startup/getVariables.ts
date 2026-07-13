import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverVariableSchema } from '@/lib/schemas/server/startup.ts';

export default async (uuid: string): Promise<z.infer<typeof serverVariableSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/startup/variables`);
  return data.variables.map((item: unknown) => parseFromApi(serverVariableSchema, item));
};

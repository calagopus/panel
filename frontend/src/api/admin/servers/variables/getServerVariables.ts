import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverVariableSchema } from '@/lib/schemas/server/startup.ts';

export default async (serverUuid: string): Promise<z.infer<typeof serverVariableSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/variables`);
  return data.variables;
};

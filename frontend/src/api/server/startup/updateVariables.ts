import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverEnvVariableSchema } from '@/lib/schemas/server/startup.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, variables: z.infer<typeof serverEnvVariableSchema>[]): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/startup/variables`, {
    variables: serializeForApi(z.array(serverEnvVariableSchema), variables),
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverEnvVariableSchema } from '@/lib/schemas/server/startup.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (serverUuid: string, variables: z.infer<typeof serverEnvVariableSchema>[]): Promise<void> => {
  await axiosInstance.put(`/api/admin/servers/${serverUuid}/variables`, {
    variables: serializeForApi(z.array(serverEnvVariableSchema), variables),
  });
};

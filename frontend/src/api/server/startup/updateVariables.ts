import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverEnvVariableSchema } from '@/lib/schemas/server/startup.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (uuid: string, variables: z.infer<typeof serverEnvVariableSchema>[]): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/startup/variables`, {
    variables: transformKeysToSnakeCase(variables),
  });
};

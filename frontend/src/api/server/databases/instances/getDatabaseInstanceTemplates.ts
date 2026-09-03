import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDatabaseInstanceTemplateSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverDatabaseInstanceTemplateSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/databases/instances/templates`);
  return data.templates.map((item: unknown) => parseFromApi(serverDatabaseInstanceTemplateSchema, item));
};

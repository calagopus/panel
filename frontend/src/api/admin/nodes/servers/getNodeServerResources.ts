import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';

const resourcesSchema = z.record(z.string(), serverResourceUsageSchema);

export default async (nodeUuid: string): Promise<z.infer<typeof resourcesSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/servers/resources`);
  return parseFromApi(resourcesSchema, data.resources);
};

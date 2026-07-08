import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminLocationDatabaseAgentHostSchema } from '@/lib/schemas/admin/locations.ts';

export default async (
  locationUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminLocationDatabaseAgentHostSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/locations/${locationUuid}/database-agent-hosts`, {
    params: { page, search },
  });
  return data.databaseAgentHosts;
};

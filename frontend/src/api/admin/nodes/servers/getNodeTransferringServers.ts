import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminNodeTransferProgressSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';

const transfersSchema = z.record(z.string(), adminNodeTransferProgressSchema);

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
): Promise<{
  servers: Pagination<z.infer<typeof adminServerSchema>>;
  transfers: z.infer<typeof transfersSchema>;
}> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/servers/transfers`, {
    params: { page, search },
  });
  return {
    servers: parsePaginationFromApi(adminServerSchema, data.servers),
    transfers: parseFromApi(transfersSchema, data.transfers),
  };
};

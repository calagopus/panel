import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';

const serverMountSchema = z.object({
  server: adminServerSchema,
  created: z.coerce.date(),
});

export default async (
  mountUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverMountSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}/servers`, {
    params: { page, search },
  });
  return parsePaginationFromApi(serverMountSchema, data.server_mounts);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';

export default async (
  mountUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<AndCreated<{ server: z.infer<typeof adminServerSchema> }>>> => {
  const { data } = await axiosInstance.get(`/api/admin/mounts/${mountUuid}/servers`, {
    params: { page, search },
  });
  return data.serverMounts;
};

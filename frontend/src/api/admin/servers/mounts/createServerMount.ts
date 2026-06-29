import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminServerMountSchema } from '@/lib/schemas/admin/servers.ts';

const createServerMountSchema = z.object({
  mountUuid: z.string(),
});

export default async (
  serverUuid: string,
  mountData: z.infer<typeof createServerMountSchema>,
): Promise<z.infer<typeof adminServerMountSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/servers/${serverUuid}/mounts`,
    serializeForApi(createServerMountSchema, mountData),
  );
  return data;
};

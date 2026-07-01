import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';

const createServerGroupSchema = z.object({
  name: z.string(),
  serverOrder: z.array(z.string()),
});

export default async (
  groupData: z.infer<typeof createServerGroupSchema>,
): Promise<z.infer<typeof userServerGroupSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/servers/groups',
    serializeForApi(createServerGroupSchema, groupData),
  );
  return data.serverGroup;
};

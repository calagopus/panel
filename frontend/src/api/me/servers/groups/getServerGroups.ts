import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';

export default async (): Promise<z.infer<typeof userServerGroupSchema>[]> => {
  const { data } = await axiosInstance.get('/api/client/servers/groups');
  return data.server_groups.map((item: unknown) => parseFromApi(userServerGroupSchema, item));
};

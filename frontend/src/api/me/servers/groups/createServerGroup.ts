import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  name: string;
  serverOrder: string[];
}

export default async (groupData: Data): Promise<z.infer<typeof userServerGroupSchema>> => {
  const { data } = await axiosInstance.post('/api/client/servers/groups', transformKeysToSnakeCase(groupData));
  return data.serverGroup;
};

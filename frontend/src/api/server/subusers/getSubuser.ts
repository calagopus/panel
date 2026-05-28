import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';

export default async (uuid: string, userUuid: string): Promise<z.infer<typeof serverSubuserSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/subusers/${userUuid}`);
  return data.subuser;
};

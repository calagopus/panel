import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverFilesPullQueryResultSchema } from '@/lib/schemas/server/files.ts';

export default async (uuid: string, url: string): Promise<z.infer<typeof serverFilesPullQueryResultSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/pull/query`, { url });
  return data.queryResult;
};

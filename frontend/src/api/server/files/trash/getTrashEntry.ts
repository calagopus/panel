import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, entry: string): Promise<z.infer<typeof serverTrashEntrySchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/trash/${entry}`);
  return parseFromApi(serverTrashEntrySchema, data.entry);
};

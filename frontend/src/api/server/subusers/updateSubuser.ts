import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverSubuserUpdateSchema } from '@/lib/schemas/server/subusers.ts';

export default async (
  uuid: string,
  userUuid: string,
  data: z.infer<typeof serverSubuserUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/servers/${uuid}/subusers/${userUuid}`,
    serializeForApi(serverSubuserUpdateSchema, data),
  );
};

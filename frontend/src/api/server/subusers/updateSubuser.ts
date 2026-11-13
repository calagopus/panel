import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSubuserUpdateSchema } from '@/lib/schemas/server/subusers.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  userUuid: string,
  data: Partial<z.infer<typeof serverSubuserUpdateSchema>>,
): Promise<void> => {
  const schema = serverSubuserUpdateSchema.partial();
  await axiosInstance.patch(`/api/client/servers/${uuid}/subusers/${userUuid}`, serializeForApi(schema, data));
};

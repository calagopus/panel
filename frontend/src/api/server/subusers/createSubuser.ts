import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi, serializeForApi } from '@/lib/api-transform.ts';
import { serverSubuserCreateSchema, serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';

const createSchema = serverSubuserCreateSchema.extend({
  captcha: z.string().nullable(),
});

export default async (
  uuid: string,
  subuserData: z.infer<typeof createSchema>,
): Promise<z.infer<typeof serverSubuserSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/subusers`,
    serializeForApi(createSchema, subuserData),
  );
  return parseFromApi(serverSubuserSchema, data.subuser);
};

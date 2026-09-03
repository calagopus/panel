import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSelectorSchema } from '@/lib/schemas/generic.ts';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const sendNodeServersPowerActionSchema = z.object({
  servers: serverSelectorSchema,
  action: serverPowerAction,
});

export default async (
  nodeUuid: string,
  servers: z.infer<typeof serverSelectorSchema>,
  action: z.infer<typeof serverPowerAction>,
): Promise<number> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/servers/power`,
    serializeForApi(sendNodeServersPowerActionSchema, { servers, action }),
  );
  return data.affected;
};

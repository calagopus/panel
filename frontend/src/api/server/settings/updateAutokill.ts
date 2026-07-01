import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverSettingsAutokillSchema } from '@/lib/schemas/server/settings.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsAutokillSchema>): Promise<void> => {
  await axiosInstance.put(
    `/api/client/servers/${uuid}/settings/auto-kill`,
    serializeForApi(serverSettingsAutokillSchema, data),
  );
};

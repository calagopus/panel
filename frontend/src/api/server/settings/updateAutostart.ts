import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverSettingsAutostartSchema } from '@/lib/schemas/server/settings.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsAutostartSchema>): Promise<void> => {
  await axiosInstance.put(
    `/api/client/servers/${uuid}/settings/auto-start`,
    serializeForApi(serverSettingsAutostartSchema, data),
  );
};

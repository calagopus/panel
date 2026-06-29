import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverSettingsTimezoneSchema } from '@/lib/schemas/server/settings.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsTimezoneSchema>): Promise<void> => {
  await axiosInstance.put(
    `/api/client/servers/${uuid}/settings/timezone`,
    serializeForApi(serverSettingsTimezoneSchema, data),
  );
};

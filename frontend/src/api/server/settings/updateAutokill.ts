import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSettingsAutokillSchema } from '@/lib/schemas/server/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsAutokillSchema>): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/settings/auto-kill`, transformKeysToSnakeCase(data));
};

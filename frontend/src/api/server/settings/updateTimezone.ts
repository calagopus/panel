import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSettingsTimezoneSchema } from '@/lib/schemas/server/settings.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsTimezoneSchema>): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/settings/timezone`, {
    ...transformKeysToSnakeCase(data),
    timezone: data.timezone || null,
  });
};

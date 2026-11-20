import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSettingsTimezoneDefaultSchema } from '@/lib/schemas/server/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string): Promise<z.infer<typeof serverSettingsTimezoneDefaultSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/settings/timezone`);
  return parseFromApi(serverSettingsTimezoneDefaultSchema, data);
};

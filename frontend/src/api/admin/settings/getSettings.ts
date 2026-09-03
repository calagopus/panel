import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminSettingsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/settings');
  return parseFromApi(adminSettingsSchema, data.settings);
};

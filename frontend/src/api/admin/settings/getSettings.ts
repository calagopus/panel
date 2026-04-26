import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';

export default async (): Promise<z.infer<typeof adminSettingsSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/settings');
  return data.settings;
};

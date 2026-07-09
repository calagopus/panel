import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';

export default async (): Promise<z.infer<typeof publicSettingsSchema>> => {
  const { data } = await axiosInstance.get('/api/settings');
  return parseFromApi(publicSettingsSchema, data);
};

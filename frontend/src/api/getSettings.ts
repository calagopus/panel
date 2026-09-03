import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof publicSettingsSchema>> => {
  const { data } = await axiosInstance.get('/api/settings');
  return parseFromApi(publicSettingsSchema, data);
};

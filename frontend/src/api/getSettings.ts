import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';

export default async (): Promise<{ settings: z.infer<typeof publicSettingsSchema>; serverTime: Date }> => {
  const { data, headers } = await axiosInstance.get('/api/settings');
  return {
    settings: data,
    serverTime: new Date(headers['date']),
  };
};

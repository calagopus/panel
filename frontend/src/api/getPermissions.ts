import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { apiPermissionsSchema } from '@/lib/schemas/generic.ts';

export default async (): Promise<z.infer<typeof apiPermissionsSchema>> => {
  const { data } = await axiosInstance.get('/api/client/permissions');
  return data;
};

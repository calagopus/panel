import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { apiPermissionsSchema } from '@/lib/schemas/generic.ts';

export default async (): Promise<z.infer<typeof apiPermissionsSchema>> => {
  const { data } = await axiosInstance.get('/api/client/permissions');
  return parseFromApi(apiPermissionsSchema, data);
};

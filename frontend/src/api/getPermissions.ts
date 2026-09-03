import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { apiPermissionsSchema } from '@/lib/schemas/generic.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof apiPermissionsSchema>> => {
  const { data } = await axiosInstance.get('/api/client/permissions');
  return parseFromApi(apiPermissionsSchema, data);
};

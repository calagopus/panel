import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/system/updates/recheck');
  return parseFromApi(adminUpdateInformationSchema, data.update_information);
};

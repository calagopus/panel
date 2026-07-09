import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema> | null> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates');
  return data.update_information ? parseFromApi(adminUpdateInformationSchema, data.update_information) : null;
};

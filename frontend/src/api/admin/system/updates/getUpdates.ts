import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema> | null> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates');
  return data.update_information ? parseFromApi(adminUpdateInformationSchema, data.update_information) : null;
};

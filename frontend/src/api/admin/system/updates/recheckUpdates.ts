import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/system/updates/recheck');
  return data.updateInformation;
};

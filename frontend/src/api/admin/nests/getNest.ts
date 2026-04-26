import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

export default async (nestUuid: string): Promise<z.infer<typeof adminNestSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/nests/${nestUuid}`);
  return data.nest;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';

export default async (externalId: string): Promise<z.infer<typeof adminFullUserSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/users/external/${encodeURIComponent(externalId)}`);
  return data.user;
};

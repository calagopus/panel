import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';

export default async (userUuid: string): Promise<z.infer<typeof adminFullUserSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/users/${userUuid}`);
  return data.user;
};

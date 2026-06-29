import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';

export default async (userUuid: string, data: z.infer<typeof adminUserUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/users/${userUuid}`, serializeForApi(adminUserUpdateSchema, data));
};

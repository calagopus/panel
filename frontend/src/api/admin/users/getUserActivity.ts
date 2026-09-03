import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userActivitySchema } from '@/lib/schemas/user/activity.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  userUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof userActivitySchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/users/${userUuid}/activity`, {
    params: { page, search },
  });
  return parsePaginationFromApi(userActivitySchema, data.activities);
};

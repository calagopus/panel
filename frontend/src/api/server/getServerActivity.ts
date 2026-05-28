import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { serverActivitySchema } from '@/lib/schemas/server/activity.ts';

export default async (
  uuid: string,
  userUuid: string | null,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof serverActivitySchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/activity`, {
    params: { user: userUuid, page, search },
  });
  return {
    ...getPaginationSet(data.activities),
    data: data.activities.data || [],
  };
};

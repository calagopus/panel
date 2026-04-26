import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';

export default async (
  page: number,
): Promise<{ outdatedNodes: Pagination<z.infer<typeof adminNodeUpdateInformationSchema>>; failedNodes: number }> => {
  const { data } = await axiosInstance.get('/api/admin/system/updates/nodes', { params: { page } });
  return data;
};

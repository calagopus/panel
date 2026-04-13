import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeUpdateInformationSchema } from '@/lib/schemas/admin/updates.ts';

export default async (
  page: number,
): Promise<{ outdatedNodes: Pagination<z.infer<typeof adminNodeUpdateInformationSchema>>; failedNodes: number }> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .get('/api/admin/system/updates/nodes', { params: { page } })
      .then(({ data }) => resolve(data))
      .catch(reject);
  });
};

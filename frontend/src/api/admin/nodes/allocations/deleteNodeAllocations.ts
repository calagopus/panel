import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeAllocationSelectorSchema } from '@/lib/schemas/admin/nodes.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const deleteNodeAllocationsSchema = z.object({
  selector: adminNodeAllocationSelectorSchema,
  force: z.boolean(),
});

export default async (
  nodeUuid: string,
  selector: z.infer<typeof adminNodeAllocationSelectorSchema>,
  force: boolean,
): Promise<{ deleted: number; skipped: number }> => {
  const { data } = await axiosInstance.delete(`/api/admin/nodes/${nodeUuid}/allocations`, {
    data: serializeForApi(deleteNodeAllocationsSchema, { selector, force }),
  });
  return data;
};

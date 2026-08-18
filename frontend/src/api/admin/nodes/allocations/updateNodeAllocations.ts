import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { adminNodeAllocationSelectorSchema } from '@/lib/schemas/admin/nodes.ts';

const updateNodeAllocationsSchema = z.object({
  selector: adminNodeAllocationSelectorSchema,
  ip: z.string(),
  ipAlias: z.string().nullable(),
});

export default async (
  nodeUuid: string,
  selector: z.infer<typeof adminNodeAllocationSelectorSchema>,
  allocationData: { ip: string; ipAlias: string | null },
): Promise<{ updated: number; skipped: number }> => {
  const { data } = await axiosInstance.patch(
    `/api/admin/nodes/${nodeUuid}/allocations`,
    serializeForApi(updateNodeAllocationsSchema, { selector, ...allocationData }),
  );
  return data;
};

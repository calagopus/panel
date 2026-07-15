import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';

const updateAllocationSchema = z.object({
  notes: z.string().nullable().optional(),
  primary: z.boolean().optional(),
});

export default async (
  serverUuid: string,
  allocationUuid: string,
  allocationData: z.infer<typeof updateAllocationSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/servers/${serverUuid}/allocations/${allocationUuid}`,
    serializeForApi(updateAllocationSchema, allocationData),
  );
};

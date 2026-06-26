import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';

const updateAllocationSchema = z.object({
  notes: z.string().nullable().optional(),
  primary: z.boolean().optional(),
});

export default async (
  serverUuid: string,
  allocationUuid: string,
  allocationData: z.infer<typeof updateAllocationSchema>,
): Promise<z.infer<typeof serverAllocationSchema>> => {
  const { data } = await axiosInstance.patch(
    `/api/admin/servers/${serverUuid}/allocations/${allocationUuid}`,
    serializeForApi(updateAllocationSchema, allocationData),
  );
  return data.allocation;
};

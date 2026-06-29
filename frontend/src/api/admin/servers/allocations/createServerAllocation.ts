import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';

export default async (
  serverUuid: string,
  allocationData: { allocationUuid: string },
): Promise<z.infer<typeof serverAllocationSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/servers/${serverUuid}/allocations`,
    serializeForApi(z.object({ allocationUuid: z.string() }), allocationData),
  );
  return data.allocation;
};

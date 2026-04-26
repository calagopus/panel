import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  notes?: string | null;
  primary?: boolean;
}

export default async (
  serverUuid: string,
  allocationUuid: string,
  allocationData: Data,
): Promise<z.infer<typeof serverAllocationSchema>> => {
  const { data } = await axiosInstance.patch(
    `/api/admin/servers/${serverUuid}/allocations/${allocationUuid}`,
    transformKeysToSnakeCase(allocationData),
  );
  return data.allocation;
};

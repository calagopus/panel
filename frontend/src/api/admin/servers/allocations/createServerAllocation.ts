import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  allocationUuid: string;
}

export default async (serverUuid: string, allocationData: Data): Promise<z.infer<typeof serverAllocationSchema>> => {
  const { data } = await axiosInstance.post(
    `/api/admin/servers/${serverUuid}/allocations`,
    transformKeysToSnakeCase(allocationData),
  );
  return data.allocation;
};

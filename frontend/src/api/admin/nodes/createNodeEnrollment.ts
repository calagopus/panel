import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeEnrollmentSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (nodeUuid: string, remote: string | null): Promise<z.infer<typeof adminNodeEnrollmentSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/enrollment`, { remote });
  return parseFromApi(adminNodeEnrollmentSchema, data);
};

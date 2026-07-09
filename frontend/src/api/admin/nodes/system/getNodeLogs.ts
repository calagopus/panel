import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';

const nodeLogFileSchema = z.object({
  name: z.string(),
  size: z.number(),
  lastModified: z.string(),
});

export type NodeLogFile = z.infer<typeof nodeLogFileSchema>;

export default async (nodeUuid: string): Promise<NodeLogFile[]> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/logs`);
  return data.log_files.map((item: unknown) => parseFromApi(nodeLogFileSchema, item));
};

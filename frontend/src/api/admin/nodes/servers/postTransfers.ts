import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSelectorSchema, transferArchiveFormat } from '@/lib/schemas/generic.ts';
import { compressionLevel } from '@/lib/schemas/server/files.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export const transferAllocationMode = z.enum([
  'none',
  'random_primary',
  'random_all',
  'preserve_ports',
  'egg_config_deployment',
  'egg_config_self_assign_range',
]);

const postTransfersSchema = z.object({
  servers: serverSelectorSchema,
  nodeUuid: z.string(),
  allocationMode: transferAllocationMode,
  transferBackups: z.boolean(),
  deleteSourceBackups: z.boolean(),
  archiveFormat: transferArchiveFormat,
  compressionLevel: compressionLevel.nullable(),
  multiplexChannels: z.number(),
});

export default async (
  nodeUuid: string,
  transferData: z.infer<typeof postTransfersSchema>,
): Promise<{ affected: number }> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/servers/transfer`,
    serializeForApi(postTransfersSchema, transferData),
  );
  return data;
};

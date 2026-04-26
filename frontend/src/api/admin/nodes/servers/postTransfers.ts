import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { archiveFormat, compressionLevel } from '@/lib/schemas/server/files.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  servers: string[];
  nodeUuid: string;
  allocationMode: 'none' | 'random_primary' | 'random_all' | 'egg_config_deployment' | 'egg_config_self_assign_range';
  transferBackups: boolean;
  deleteSourceBackups: boolean;
  archiveFormat: z.infer<typeof archiveFormat>;
  compressionLevel: z.infer<typeof compressionLevel> | null;
  multiplexChannels: number;
}

export default async (nodeUuid: string, transferData: Data): Promise<{ affected: number }> => {
  const { data } = await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/servers/transfer`,
    transformKeysToSnakeCase(transferData),
  );
  return data;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeSetupProbeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (url: string, pairingCode: string): Promise<z.infer<typeof adminNodeSetupProbeSchema>> => {
  const { data } = await axiosInstance.post('/api/admin/nodes/probe', {
    url,
    pairing_code: pairingCode,
  });
  return parseFromApi(adminNodeSetupProbeSchema, data.probe);
};

import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import { axiosInstance } from '@/api/axios.ts';
import { getNodeUrl } from '@/lib/domain/node.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';

export interface NodeSystemDirect {
  version: string | null;
}

export default async (node: AdminNode): Promise<NodeSystemDirect> => {
  const { token } = await getNodeToken(node.uuid);

  const { data } = await axiosInstance.get(getNodeUrl(node, '/api/system'), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });

  return { version: typeof data?.version === 'string' ? data.version : null };
};

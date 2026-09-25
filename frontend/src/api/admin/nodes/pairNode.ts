import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, pairingCode: string, remote: string | null): Promise<void> => {
  await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/pair`, {
    pairing_code: pairingCode,
    remote,
  });
};

import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, mountUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/nodes/${nodeUuid}/mounts/${mountUuid}`);
};

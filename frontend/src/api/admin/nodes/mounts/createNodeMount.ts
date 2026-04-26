import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, mountUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/mounts`, {
    mount_uuid: mountUuid,
  });
};

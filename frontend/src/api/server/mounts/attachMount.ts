import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, mountUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/mounts`, {
    mount_uuid: mountUuid,
  });
};

import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, command: string): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/startup/command`, {
    command,
  });
};

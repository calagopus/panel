import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, image: string): Promise<void> => {
  await axiosInstance.put(`/api/client/servers/${uuid}/startup/docker-image`, {
    image,
  });
};

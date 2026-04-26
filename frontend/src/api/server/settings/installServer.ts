import { axiosInstance } from '@/api/axios.ts';

interface Data {
  truncateDirectory: boolean;
}

export default async (uuid: string, data: Data): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/settings/install`, {
    truncate_directory: data.truncateDirectory,
  });
};

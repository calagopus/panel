import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, operationUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/files/operations/${operationUuid}`);
};

import { axiosInstance } from '@/api/axios.ts';

export default async (apiKeyUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/api-keys/${apiKeyUuid}`);
};

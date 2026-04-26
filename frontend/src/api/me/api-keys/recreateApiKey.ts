import { axiosInstance } from '@/api/axios.ts';

export default async (apiKeyUuid: string): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/account/api-keys/${apiKeyUuid}/recreate`);
  return data.key;
};

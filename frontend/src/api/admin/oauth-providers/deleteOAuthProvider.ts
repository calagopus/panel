import { axiosInstance } from '@/api/axios.ts';

export default async (oauthProviderUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/oauth-providers/${oauthProviderUuid}`);
};

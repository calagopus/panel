import { axiosInstance } from '@/api/axios.ts';

export default async (oauthLinkUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/oauth-links/${oauthLinkUuid}`);
};

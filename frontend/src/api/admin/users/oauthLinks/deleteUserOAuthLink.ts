import { axiosInstance } from '@/api/axios.ts';

export default async (userUuid: string, oauthLinkUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/users/${userUuid}/oauth-links/${oauthLinkUuid}`);
};

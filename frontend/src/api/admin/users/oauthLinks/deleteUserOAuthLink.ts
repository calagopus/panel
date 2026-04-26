import { axiosInstance } from '@/api/axios.ts';

export default async (userUuid: string, oauthLinkUuid: string): Promise<void> => {
  const { data } = await axiosInstance.delete(`/api/admin/users/${userUuid}/oauth-links/${oauthLinkUuid}`);
  return data.oauthLink;
};

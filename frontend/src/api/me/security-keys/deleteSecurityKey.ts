import { axiosInstance } from '@/api/axios.ts';

export default async (securityKeyUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/security-keys/${securityKeyUuid}`);
};

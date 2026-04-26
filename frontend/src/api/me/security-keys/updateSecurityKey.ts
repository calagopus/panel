import { axiosInstance } from '@/api/axios.ts';

interface Data {
  name: string;
}

export default async (securityKeyUuid: string, data: Data): Promise<void> => {
  await axiosInstance.patch(`/api/client/account/security-keys/${securityKeyUuid}`, data);
};

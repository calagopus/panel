import { axiosInstance } from '@/api/axios.ts';

interface Data {
  name: string;
}

export default async (sshKeyUuid: string, data: Data): Promise<void> => {
  await axiosInstance.patch(`/api/client/account/ssh-keys/${sshKeyUuid}`, data);
};

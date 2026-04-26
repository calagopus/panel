import { axiosInstance } from '@/api/axios.ts';

export default async (sshKeyUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/ssh-keys/${sshKeyUuid}`);
};

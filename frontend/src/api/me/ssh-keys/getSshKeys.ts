import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSshKeySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/ssh-keys', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.sshKeys),
    data: data.sshKeys.data || [],
  };
};

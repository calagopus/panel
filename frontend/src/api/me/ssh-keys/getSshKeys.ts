import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parsePaginationFromApi } from '@/lib/api-transform.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSshKeySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/ssh-keys', {
    params: { page, search },
  });
  return parsePaginationFromApi(userSshKeySchema, data.ssh_keys);
};

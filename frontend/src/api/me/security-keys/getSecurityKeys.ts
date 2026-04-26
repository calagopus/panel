import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSecurityKeySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/security-keys', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.securityKeys),
    data: data.securityKeys.data || [],
  };
};

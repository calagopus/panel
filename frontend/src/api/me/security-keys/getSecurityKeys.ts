import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userSecurityKeySchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/security-keys', {
    params: { page, search },
  });
  return parsePaginationFromApi(userSecurityKeySchema, data.security_keys);
};

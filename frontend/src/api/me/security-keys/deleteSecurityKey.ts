import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userSecurityKeyDeleteSchema } from '@/lib/schemas/user/securityKeys.ts';

export default async (
  securityKeyUuid: string,
  data: z.infer<typeof userSecurityKeyDeleteSchema> = { password: '' },
): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/security-keys/${securityKeyUuid}`, {
    data: serializeForApi(userSecurityKeyDeleteSchema, data),
  });
};

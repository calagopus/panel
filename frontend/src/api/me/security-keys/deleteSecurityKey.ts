import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSecurityKeyDeleteSchema } from '@/lib/schemas/user/securityKeys.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  securityKeyUuid: string,
  data: z.infer<typeof userSecurityKeyDeleteSchema> = { password: '' },
): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/security-keys/${securityKeyUuid}`, {
    data: serializeForApi(userSecurityKeyDeleteSchema, data),
  });
};

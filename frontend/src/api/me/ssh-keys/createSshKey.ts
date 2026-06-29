import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';

const createSshKeySchema = z.object({
  name: z.string(),
  publicKey: z.string(),
});

export default async (keyData: z.infer<typeof createSshKeySchema>): Promise<z.infer<typeof userSshKeySchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/ssh-keys',
    serializeForApi(createSshKeySchema, keyData),
  );
  return data.sshKey;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

const createSshKeySchema = z.object({
  name: z.string(),
  publicKey: z.string(),
});

export default async (keyData: z.infer<typeof createSshKeySchema>): Promise<z.infer<typeof userSshKeySchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/ssh-keys',
    serializeForApi(createSshKeySchema, keyData),
  );
  return parseFromApi(userSshKeySchema, data.ssh_key);
};

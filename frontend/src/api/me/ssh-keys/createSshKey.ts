import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  name: string;
  publicKey: string;
}

export default async (keyData: Data): Promise<z.infer<typeof userSshKeySchema>> => {
  const { data } = await axiosInstance.post('/api/client/account/ssh-keys', transformKeysToSnakeCase(keyData));
  return data.sshKey;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSshKeyProvider, userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';

interface Data {
  provider: z.infer<typeof userSshKeyProvider>;
  username: string;
}

export default async (keyData: Data): Promise<z.infer<typeof userSshKeySchema>[]> => {
  const { data } = await axiosInstance.post('/api/client/account/ssh-keys/import', keyData);
  return data.sshKeys;
};

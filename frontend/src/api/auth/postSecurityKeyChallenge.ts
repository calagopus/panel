import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { prepareCredentialForTransport } from '../me/security-keys/postSecurityKeyChallenge.ts';

interface Response {
  user: z.infer<typeof fullUserSchema>;
}

export default async (uuid: string, challenge: PublicKeyCredential): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/login/security-key', {
    uuid,
    public_key_credential: prepareCredentialForTransport(challenge),
  });
  return data;
};

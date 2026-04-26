import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { base64ToArrayBuffer } from '@/lib/transformers.ts';

function prepareCredentialOptions(options: CredentialCreationOptions): CredentialCreationOptions {
  if (!options.publicKey) {
    return options;
  }

  const publicKey = options.publicKey as PublicKeyCredentialCreationOptions;
  const processedPublicKey: PublicKeyCredentialCreationOptions = { ...publicKey };

  if (typeof publicKey.challenge === 'string') {
    processedPublicKey.challenge = base64ToArrayBuffer(publicKey.challenge);
  }

  if (publicKey.user && typeof publicKey.user.id === 'string') {
    processedPublicKey.user = {
      ...publicKey.user,
      id: base64ToArrayBuffer(publicKey.user.id),
    };
  }

  if (publicKey.excludeCredentials) {
    processedPublicKey.excludeCredentials = publicKey.excludeCredentials.map((credential) => {
      if (typeof credential.id === 'string') {
        return {
          ...credential,
          id: base64ToArrayBuffer(credential.id),
        };
      }
      return credential;
    });
  }

  return {
    ...options,
    publicKey: processedPublicKey,
  };
}

interface Data {
  name: string;
}

export default async (data: Data): Promise<[z.infer<typeof userSecurityKeySchema>, CredentialCreationOptions]> => {
  const { data: responseData } = await axiosInstance.post('/api/client/account/security-keys', data);
  return [responseData.securityKey, prepareCredentialOptions(responseData.options)];
};

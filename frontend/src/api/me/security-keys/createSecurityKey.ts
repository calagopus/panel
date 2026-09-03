import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userSecurityKeyCreateSchema, userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';
import { base64ToArrayBuffer } from '@/lib/serialization/transformers.ts';

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

export default async (
  data: z.infer<typeof userSecurityKeyCreateSchema>,
): Promise<[z.infer<typeof userSecurityKeySchema>, CredentialCreationOptions]> => {
  const { data: responseData } = await axiosInstance.post(
    '/api/client/account/security-keys',
    serializeForApi(userSecurityKeyCreateSchema, data),
  );
  return [
    parseFromApi(userSecurityKeySchema, responseData.security_key),
    prepareCredentialOptions(responseData.options),
  ];
};

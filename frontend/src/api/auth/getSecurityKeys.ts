import { axiosInstance } from '@/api/axios.ts';
import { base64ToArrayBuffer } from '@/lib/transformers.ts';

function prepareCredentialOptions(options: CredentialRequestOptions): CredentialRequestOptions {
  if (!options.publicKey) {
    return options;
  }

  const publicKey = options.publicKey as PublicKeyCredentialRequestOptions;
  const processedPublicKey: PublicKeyCredentialRequestOptions = { ...publicKey };

  if (typeof publicKey.challenge === 'string') {
    processedPublicKey.challenge = base64ToArrayBuffer(publicKey.challenge);
  }

  if (publicKey.allowCredentials) {
    processedPublicKey.allowCredentials = publicKey.allowCredentials.map((credential) => {
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

interface Response {
  uuid: string;
  options: CredentialRequestOptions;
}

export default async (user: string): Promise<Response> => {
  const { data } = await axiosInstance.get('/api/auth/login/security-key', { params: { user } });
  return {
    uuid: data.uuid,
    options: prepareCredentialOptions(data.options),
  };
};

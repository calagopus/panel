import { axiosInstance } from '@/api/axios.ts';
import { base64ToArrayBuffer } from '@/lib/serialization/transformers.ts';

function prepareCredentialOptions(options: CredentialRequestOptions): CredentialRequestOptions {
  if (!options.publicKey) {
    return options;
  }

  const publicKey = options.publicKey as PublicKeyCredentialRequestOptions;
  const processedPublicKey: PublicKeyCredentialRequestOptions = { ...publicKey };

  if (typeof publicKey.challenge === 'string') {
    processedPublicKey.challenge = base64ToArrayBuffer(publicKey.challenge);
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

export default async (): Promise<Response> => {
  const { data } = await axiosInstance.get('/api/auth/login/security-key/discoverable');
  return {
    uuid: data.uuid,
    options: prepareCredentialOptions(data.options),
  };
};

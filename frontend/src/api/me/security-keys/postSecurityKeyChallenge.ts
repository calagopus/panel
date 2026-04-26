import { axiosInstance } from '@/api/axios.ts';

type SerializedCredentialResponse = {
  clientDataJSON?: string;
  attestationObject?: string;
  authenticatorData?: string;
  signature?: string;
  userHandle?: string | null;
};

type SerializedCredential = {
  id: string;
  rawId: string;
  type: string;
  response: SerializedCredentialResponse;
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
};

export function prepareCredentialForTransport(credential: PublicKeyCredential): SerializedCredential {
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  if (!credential || !credential.id || !credential.rawId || !credential.type || !credential.response) {
    throw new Error('Invalid credential object');
  }

  const serializedCredential: SerializedCredential = {
    id: credential.id,
    rawId: arrayBufferToBase64(credential.rawId),
    type: credential.type,
    response: {},
  };

  const response = credential.response as AuthenticatorResponse & {
    attestationObject?: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    signature?: ArrayBuffer;
    userHandle?: ArrayBuffer | null;
  };

  if (response.clientDataJSON) {
    serializedCredential.response.clientDataJSON = arrayBufferToBase64(response.clientDataJSON);
  }

  if (response.attestationObject) {
    serializedCredential.response.attestationObject = arrayBufferToBase64(response.attestationObject);
  }

  if (response.authenticatorData) {
    serializedCredential.response.authenticatorData = arrayBufferToBase64(response.authenticatorData);
  }

  if (response.signature) {
    serializedCredential.response.signature = arrayBufferToBase64(response.signature);
  }

  if (response.userHandle) {
    serializedCredential.response.userHandle = arrayBufferToBase64(response.userHandle);
  }

  if (credential.getClientExtensionResults) {
    serializedCredential.clientExtensionResults = credential.getClientExtensionResults();
  }

  return serializedCredential;
}

export default async (securityKeyUuid: string, challenge: PublicKeyCredential): Promise<void> => {
  await axiosInstance.post(`/api/client/account/security-keys/${securityKeyUuid}/challenge`, {
    public_key_credential: prepareCredentialForTransport(challenge),
  });
};

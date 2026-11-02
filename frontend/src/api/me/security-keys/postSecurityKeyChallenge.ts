import { axiosInstance } from '@/api/axios.ts';
import { arrayBufferToBase64Url } from '@/lib/serialization/transformers.ts';

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
  if (!credential || !credential.id || !credential.rawId || !credential.type || !credential.response) {
    throw new Error('Invalid credential object');
  }

  const serializedCredential: SerializedCredential = {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
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
    serializedCredential.response.clientDataJSON = arrayBufferToBase64Url(response.clientDataJSON);
  }

  if (response.attestationObject) {
    serializedCredential.response.attestationObject = arrayBufferToBase64Url(response.attestationObject);
  }

  if (response.authenticatorData) {
    serializedCredential.response.authenticatorData = arrayBufferToBase64Url(response.authenticatorData);
  }

  if (response.signature) {
    serializedCredential.response.signature = arrayBufferToBase64Url(response.signature);
  }

  if (response.userHandle) {
    serializedCredential.response.userHandle = arrayBufferToBase64Url(response.userHandle);
  }

  if (credential.getClientExtensionResults) {
    serializedCredential.clientExtensionResults = credential.getClientExtensionResults();
  }

  return serializedCredential;
}

export default async (securityKeyUuid: string, challenge: PublicKeyCredential): Promise<string> => {
  const { data } = await axiosInstance.post(`/api/client/account/security-keys/${securityKeyUuid}/challenge`, {
    public_key_credential: prepareCredentialForTransport(challenge),
  });
  return data.credential_id;
};

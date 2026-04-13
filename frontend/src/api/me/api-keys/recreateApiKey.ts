import { axiosInstance } from '@/api/axios.ts';

export default async (apiKeyUuid: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .post(`/api/client/account/api-keys/${apiKeyUuid}/recreate`)
      .then(({ data }) => resolve(data.key))
      .catch(reject);
  });
};

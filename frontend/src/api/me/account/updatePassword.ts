import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  password: string;
  newPassword: string;
}

export default async (data: Data): Promise<void> => {
  await axiosInstance.put('/api/client/account/password', transformKeysToSnakeCase(data));
};

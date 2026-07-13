import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, instanceUuid: string, userUuid: string): Promise<string> => {
  const { data } = await axiosInstance.post(
    `/api/client/servers/${uuid}/databases/instances/${instanceUuid}/users/${userUuid}/rotate-password`,
  );
  return data.password;
};

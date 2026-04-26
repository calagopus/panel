import { axiosInstance } from '@/api/axios.ts';

export default async (avatarData: Blob): Promise<string> => {
  const { data } = await axiosInstance.put('/api/client/account/avatar', avatarData, {
    headers: {
      'Content-Type': avatarData.type,
    },
  });
  return data.avatar;
};

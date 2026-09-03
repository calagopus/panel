import { axiosInstance } from '@/api/axios.ts';
import { UserSettingsMap, userSettingsMapSchema } from '@/lib/schemas/user/settings.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<UserSettingsMap> => {
  const { data } = await axiosInstance.get('/api/client/account/settings');
  return parseFromApi(userSettingsMapSchema, data.settings);
};

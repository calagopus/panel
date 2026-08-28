import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { UserSettingsMap, userSettingsMapSchema } from '@/lib/schemas/user/settings.ts';

export default async (): Promise<UserSettingsMap> => {
  const { data } = await axiosInstance.get('/api/client/account/settings');
  return parseFromApi(userSettingsMapSchema, data.settings);
};

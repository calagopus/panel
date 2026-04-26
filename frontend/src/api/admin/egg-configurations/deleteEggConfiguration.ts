import { axiosInstance } from '@/api/axios.ts';

export default async (eggConfigurationUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/egg-configurations/${eggConfigurationUuid}`);
};

import { axiosInstance } from '@/api/axios.ts';
import { TwoFactorSetupResponse } from '@/pages/dashboard/account/actions/TwoFactorSetupButton.tsx';

export default async (): Promise<TwoFactorSetupResponse> => {
  const { data } = await axiosInstance.get('/api/client/account/two-factor');
  return { ...data } as TwoFactorSetupResponse;
};

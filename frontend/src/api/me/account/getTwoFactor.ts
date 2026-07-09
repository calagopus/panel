import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { TwoFactorSetupResponse } from '@/pages/dashboard/account/actions/TwoFactorSetupButton.tsx';

const twoFactorSetupSchema = z.object({
  otpUrl: z.string(),
  secret: z.string(),
});

export default async (): Promise<TwoFactorSetupResponse> => {
  const { data } = await axiosInstance.get('/api/client/account/two-factor');
  return parseFromApi(twoFactorSetupSchema, data);
};

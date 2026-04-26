import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardTwoFactorEnableSchema } from '@/lib/schemas/dashboard.ts';

interface Response {
  recoveryCodes: string[];
}

export default async (twoFactorData: z.infer<typeof dashboardTwoFactorEnableSchema>): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/client/account/two-factor', twoFactorData);
  return data;
};

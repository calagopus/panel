import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardTwoFactorDisableSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: z.infer<typeof dashboardTwoFactorDisableSchema>): Promise<void> => {
  await axiosInstance.delete('/api/client/account/two-factor', {
    data,
  });
};

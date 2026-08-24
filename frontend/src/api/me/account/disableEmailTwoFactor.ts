import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardEmailTwoFactorToggleSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: z.infer<typeof dashboardEmailTwoFactorToggleSchema>): Promise<void> => {
  await axiosInstance.delete('/api/client/account/two-factor/email', {
    data,
  });
};

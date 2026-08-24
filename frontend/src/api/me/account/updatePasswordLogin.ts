import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardPasswordLoginSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: z.infer<typeof dashboardPasswordLoginSchema> & { disabled: boolean }): Promise<void> => {
  await axiosInstance.put('/api/client/account/password-login', data);
};

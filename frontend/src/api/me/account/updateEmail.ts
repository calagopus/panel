import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardEmailSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: z.infer<typeof dashboardEmailSchema>): Promise<void> => {
  await axiosInstance.put('/api/client/account/email', data);
};

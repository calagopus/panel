import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { dashboardAccountSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: Partial<z.infer<typeof dashboardAccountSchema>>): Promise<void> => {
  await axiosInstance.patch('/api/client/account', serializeForApi(dashboardAccountSchema.partial(), data));
};

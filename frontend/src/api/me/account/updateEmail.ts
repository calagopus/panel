import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardEmailSchema } from '@/lib/schemas/dashboard.ts';

interface Response {
  pending: boolean;
}

export default async (data: z.infer<typeof dashboardEmailSchema>): Promise<Response> => {
  const { data: response } = await axiosInstance.put('/api/client/account/email', data);
  return response;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardAccountSchema } from '@/lib/schemas/dashboard.ts';

export default async (data: Partial<z.infer<typeof dashboardAccountSchema>>): Promise<void> => {
  await axiosInstance.patch('/api/client/account', {
    username: data.username,
    name_first: data.nameFirst,
    name_last: data.nameLast,
    language: data.language,
    toast_position: data.toastPosition,
    start_on_grouped_servers: data.startOnGroupedServers,
  });
};

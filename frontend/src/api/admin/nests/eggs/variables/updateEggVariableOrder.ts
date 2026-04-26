import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string, order: string[]): Promise<void> => {
  await axiosInstance.put(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/variables/order`, { variable_order: order });
};

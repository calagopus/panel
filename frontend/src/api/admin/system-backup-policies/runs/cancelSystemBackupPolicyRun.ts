import { axiosInstance } from '@/api/axios.ts';

export default async (policyUuid: string, runUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/system-backup-policies/${policyUuid}/runs/${runUuid}/cancel`);
};

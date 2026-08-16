import { axiosInstance } from '@/api/axios.ts';

export default async (policyUuid: string, serverUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/system-backup-policies/${policyUuid}/servers/${serverUuid}`);
};

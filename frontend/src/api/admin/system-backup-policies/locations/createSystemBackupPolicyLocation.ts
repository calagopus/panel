import { axiosInstance } from '@/api/axios.ts';

export default async (policyUuid: string, locationUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/system-backup-policies/${policyUuid}/locations`, {
    location_uuid: locationUuid,
  });
};

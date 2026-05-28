import { axiosInstance } from '@/api/axios.ts';

export default async (announcementUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/announcements/${announcementUuid}`);
};

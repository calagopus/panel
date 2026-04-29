import { axiosInstance } from '@/api/axios.ts';

export default async (packageName: string, removeMigrations: boolean): Promise<void> => {
  await axiosInstance.delete(`/api/admin/extensions/manage/${packageName}`, {
    data: { remove_migrations: removeMigrations },
  });
};

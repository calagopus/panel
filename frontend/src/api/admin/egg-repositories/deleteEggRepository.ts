import { axiosInstance } from '@/api/axios.ts';

export default async (eggRepositoryUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/egg-repositories/${eggRepositoryUuid}`);
};

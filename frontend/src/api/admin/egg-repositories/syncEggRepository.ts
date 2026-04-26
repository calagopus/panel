import { axiosInstance } from '@/api/axios.ts';

export default async (eggRepositoryUuid: string): Promise<number> => {
  const { data } = await axiosInstance.post(`/api/admin/egg-repositories/${eggRepositoryUuid}/sync`, {});
  return data.found;
};

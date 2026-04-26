import { axiosInstance } from '@/api/axios.ts';

export default async (
  eggRepositoryUuid: string,
  eggRepositoryEggUuids: string[],
  nestUuid: string,
): Promise<number> => {
  const { data } = await axiosInstance.post(`/api/admin/egg-repositories/${eggRepositoryUuid}/eggs/install`, {
    nest_uuid: nestUuid,
    egg_uuids: eggRepositoryEggUuids,
  });
  return data.installed;
};

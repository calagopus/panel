import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string, destinationNestUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/move`, {
    destination_nest_uuid: destinationNestUuid,
  });
};

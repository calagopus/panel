import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  deleteEggs: boolean;
}

export default async (nestUuid: string, data: Data): Promise<void> => {
  await axiosInstance.delete(`/api/admin/nests/${nestUuid}`, {
    data: transformKeysToSnakeCase(data),
  });
};

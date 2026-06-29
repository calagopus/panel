import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  force: boolean;
  deleteBackups: boolean;
}

export default async (serverUuid: string, data: Data): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${serverUuid}`, {
    data: transformKeysToSnakeCase(data),
  });
};

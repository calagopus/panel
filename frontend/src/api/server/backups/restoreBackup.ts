import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  truncateDirectory: boolean;
}

export default async (uuid: string, backupUuid: string, data: Data): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/backups/${backupUuid}/restore`, transformKeysToSnakeCase(data));
};

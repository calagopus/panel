import { axiosInstance } from '@/api/axios.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

interface Data {
  serverUuid: string;
  truncateDirectory: boolean;
}

export default async (nodeUuid: string, backupUuid: string, data: Data): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/nodes/${nodeUuid}/backups/${backupUuid}/restore`,
    transformKeysToSnakeCase(data),
  );
};

import { axiosInstance } from '@/api/axios.ts';

export interface NodeLogFile {
  name: string;
  size: number;
  lastModified: string;
}

export default async (nodeUuid: string): Promise<NodeLogFile[]> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/logs`);
  return data.logFiles;
};

import { axiosInstance } from '@/api/axios.ts';

export default async (teamUuid: string, serverUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/teams/${teamUuid}/servers`, { server_uuid: serverUuid });
};

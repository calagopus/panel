import { axiosInstance } from '@/api/axios.ts';

export default async (
  uuid: string,
  entry: string,
  restorations: string[],
): Promise<{ returned: string[]; unavailable: string[] }> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/trash/${entry}/return`, {
    restorations,
  });
  return { returned: data.returned, unavailable: data.unavailable };
};

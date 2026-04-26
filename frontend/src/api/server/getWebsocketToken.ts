import { axiosInstance } from '@/api/axios.ts';

interface Response {
  token: string;
  socket: string;
}

export default async (uuid: string): Promise<Response> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/websocket`);
  return {
    token: data.token,
    socket: data.url,
  };
};

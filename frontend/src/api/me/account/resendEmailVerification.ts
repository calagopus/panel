import { axiosInstance } from '@/api/axios.ts';

interface Response {
  email: string;
}

export default async (): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/client/account/email/resend-verification');
  return data;
};

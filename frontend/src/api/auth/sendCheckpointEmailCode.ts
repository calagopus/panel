import { axiosInstance } from '@/api/axios.ts';

interface Data {
  confirmation_token: string;
}

export default async ({ confirmation_token }: Data): Promise<void> => {
  await axiosInstance.post('/api/auth/login/checkpoint/email', { confirmation_token });
};

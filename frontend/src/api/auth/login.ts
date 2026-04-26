import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { fullUserSchema, userSchema } from '@/lib/schemas/user.ts';

interface Data {
  user: string;
  password: string;
  captcha: string | null;
}

type Response =
  | {
      type: 'completed';
      user: z.infer<typeof fullUserSchema>;
    }
  | {
      type: 'two_factor_required';
      user: z.infer<typeof userSchema>;
      token: string;
    };

export default async ({ user, password, captcha }: Data): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/login', { user, password, captcha });
  return data;
};

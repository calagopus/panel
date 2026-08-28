import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { fullUserSchema, type twoFactorMethod, userSchema } from '@/lib/schemas/user.ts';

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
      methods: z.infer<typeof twoFactorMethod>[];
    };

export default async ({ user, password, captcha }: Data): Promise<Response> => {
  const { data } = await axiosInstance.post('/api/auth/login', { user, password, captcha });
  return {
    ...data,
    user: parseFromApi(data.type === 'completed' ? fullUserSchema : userSchema, data.user),
  };
};

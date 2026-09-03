import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardEmailTwoFactorToggleSchema } from '@/lib/schemas/dashboard.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const enableEmailTwoFactorResponseSchema = z.object({
  recoveryCodes: z.array(z.string()),
});

export default async (
  emailTwoFactorData: z.infer<typeof dashboardEmailTwoFactorToggleSchema>,
): Promise<z.infer<typeof enableEmailTwoFactorResponseSchema>> => {
  const { data } = await axiosInstance.post('/api/client/account/two-factor/email', emailTwoFactorData);
  return parseFromApi(enableEmailTwoFactorResponseSchema, data);
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { dashboardTwoFactorEnableSchema } from '@/lib/schemas/dashboard.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const enableTwoFactorResponseSchema = z.object({
  recoveryCodes: z.array(z.string()),
});

export default async (
  twoFactorData: z.infer<typeof dashboardTwoFactorEnableSchema>,
): Promise<z.infer<typeof enableTwoFactorResponseSchema>> => {
  const { data } = await axiosInstance.post('/api/client/account/two-factor', twoFactorData);
  return parseFromApi(enableTwoFactorResponseSchema, data);
};

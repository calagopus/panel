import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';

export default async (step: z.infer<typeof oobeStepKey>): Promise<void> => {
  await axiosInstance.put('/api/admin/settings', {
    oobe_step: step,
  });
};

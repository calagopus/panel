import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/updates.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema> | null> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .get('/api/admin/system/updates')
      .then(({ data }) => resolve(data.updateInformation))
      .catch(reject);
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/updates.ts';

export default async (): Promise<z.infer<typeof adminUpdateInformationSchema>> => {
  return new Promise((resolve, reject) => {
    axiosInstance
      .post('/api/admin/system/updates/recheck')
      .then(({ data }) => resolve(data.updateInformation))
      .catch(reject);
  });
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';

export default async (page: number): Promise<Pagination<z.infer<typeof storageAssetSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/assets', {
    params: { page, per_page: 100 },
  });
  return data.assets;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (directory: string, search: string): Promise<z.infer<typeof storageAssetSchema>[]> => {
  const { data } = await axiosInstance.post('/api/admin/assets/search', {
    per_page: 100,
    directory,
    search,
  });
  return data.assets.map((asset: unknown) => parseFromApi(storageAssetSchema, asset));
};

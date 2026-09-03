import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  nestUuid: string,
  urls: string[],
): Promise<{ eggs: z.infer<typeof adminEggSchema>[]; failures: { url: string; error: string }[] }> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/import/url`, { urls });
  return {
    eggs: data.eggs.map((egg: unknown) => parseFromApi(adminEggSchema, egg)),
    failures: data.failures,
  };
};

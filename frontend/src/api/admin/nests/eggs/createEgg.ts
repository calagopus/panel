import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggConfigScriptSchema, adminEggSchema, adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (
  nestUuid: string,
  eggData: z.infer<typeof adminEggUpdateSchema> & { configScript: z.infer<typeof adminEggConfigScriptSchema> },
): Promise<z.infer<typeof adminEggSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs`, {
    ...transformKeysToSnakeCase(eggData),
    docker_images: eggData.dockerImages,
  });
  return data.egg;
};

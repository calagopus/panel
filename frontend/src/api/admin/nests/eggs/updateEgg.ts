import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { transformKeysToSnakeCase } from '@/lib/transformers.ts';

export default async (nestUuid: string, eggUuid: string, data: z.infer<typeof adminEggUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}`, {
    ...transformKeysToSnakeCase(data),
    docker_images: data.dockerImages,
  });
};

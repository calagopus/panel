import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  eggRepositoryUuid: string,
  data: z.infer<typeof adminEggRepositoryUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/egg-repositories/${eggRepositoryUuid}`,
    serializeForApi(adminEggRepositoryUpdateSchema, data, formExtensionSchemas('admin.eggRepositories.createOrUpdate')),
  );
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositorySshHostKeySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (gitRepository: string): Promise<z.infer<typeof adminEggRepositorySshHostKeySchema>[]> => {
  const { data } = await axiosInstance.post('/api/admin/egg-repositories/ssh-host-keys', {
    git_repository: gitRepository,
  });
  return data.ssh_host_keys.map((item: unknown) => parseFromApi(adminEggRepositorySshHostKeySchema, item));
};

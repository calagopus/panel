import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { serverSettingsRenameSchema } from '@/lib/schemas/server/settings.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsRenameSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/settings/rename`,
    serializeForApi(serverSettingsRenameSchema, data),
  );
};

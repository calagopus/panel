import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverSettingsRenameSchema } from '@/lib/schemas/server/settings.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, data: z.infer<typeof serverSettingsRenameSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/client/servers/${uuid}/settings/rename`,
    serializeForApi(serverSettingsRenameSchema, data),
  );
};

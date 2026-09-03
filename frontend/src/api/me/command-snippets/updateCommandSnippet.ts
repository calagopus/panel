import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  commandSnippetUuid: string,
  data: z.infer<typeof userCommandSnippetUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(
    `/api/client/account/command-snippets/${commandSnippetUuid}`,
    serializeForApi(userCommandSnippetUpdateSchema, data),
  );
};

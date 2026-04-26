import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';

export default async (
  commandSnippetUuid: string,
  data: z.infer<typeof userCommandSnippetUpdateSchema>,
): Promise<void> => {
  await axiosInstance.patch(`/api/client/account/command-snippets/${commandSnippetUuid}`, data);
};

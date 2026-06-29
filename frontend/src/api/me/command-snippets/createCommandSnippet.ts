import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/api-transform.ts';
import { userCommandSnippetSchema, userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';

export default async (
  snippetData: z.infer<typeof userCommandSnippetUpdateSchema>,
): Promise<z.infer<typeof userCommandSnippetSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/command-snippets',
    serializeForApi(userCommandSnippetUpdateSchema, snippetData),
  );
  return data.commandSnippet;
};

import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetSchema, userCommandSnippetUpdateSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  snippetData: z.infer<typeof userCommandSnippetUpdateSchema>,
): Promise<z.infer<typeof userCommandSnippetSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/client/account/command-snippets',
    serializeForApi(userCommandSnippetUpdateSchema, snippetData),
  );
  return parseFromApi(userCommandSnippetSchema, data.command_snippet);
};

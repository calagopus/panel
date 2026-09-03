import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (snippetUuid: string, name: string): Promise<z.infer<typeof userCommandSnippetSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/account/command-snippets/${snippetUuid}/duplicate`, { name });
  return parseFromApi(userCommandSnippetSchema, data.command_snippet);
};

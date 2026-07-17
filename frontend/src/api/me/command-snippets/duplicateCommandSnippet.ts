import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/api-transform.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';

export default async (snippetUuid: string, name: string): Promise<z.infer<typeof userCommandSnippetSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/account/command-snippets/${snippetUuid}/duplicate`, { name });
  return parseFromApi(userCommandSnippetSchema, data.command_snippet);
};

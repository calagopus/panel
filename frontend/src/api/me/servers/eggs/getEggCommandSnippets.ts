import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';

export default async (eggUuid: string): Promise<z.infer<typeof userCommandSnippetSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/eggs/${eggUuid}/command-snippets`);
  return data.commandSnippets;
};

import { z } from 'zod';
import { axiosInstance, getPaginationSet } from '@/api/axios.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';

export default async (page: number, search?: string): Promise<Pagination<z.infer<typeof userCommandSnippetSchema>>> => {
  const { data } = await axiosInstance.get('/api/client/account/command-snippets', {
    params: { page, search },
  });
  return {
    ...getPaginationSet(data.commandSnippets),
    data: data.commandSnippets.data || [],
  };
};

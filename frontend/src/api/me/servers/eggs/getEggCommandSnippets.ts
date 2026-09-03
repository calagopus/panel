import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (eggUuid: string): Promise<z.infer<typeof userCommandSnippetSchema>[]> => {
  const { data } = await axiosInstance.get(`/api/client/servers/eggs/${eggUuid}/command-snippets`);
  return data.command_snippets.map((item: unknown) => parseFromApi(userCommandSnippetSchema, item));
};

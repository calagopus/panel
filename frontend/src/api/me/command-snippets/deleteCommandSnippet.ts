import { axiosInstance } from '@/api/axios.ts';

export default async (commandSnippetUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/account/command-snippets/${commandSnippetUuid}`);
};

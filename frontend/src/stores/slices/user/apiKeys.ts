import { z } from 'zod';
import { StateCreator } from 'zustand';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { UserStore } from '@/stores/user.ts';

export interface ApiKeySlice {
  apiKeys: Pagination<z.infer<typeof userApiKeySchema>>;

  setApiKeys: (keys: Pagination<z.infer<typeof userApiKeySchema>>) => void;
  addApiKey: (key: z.infer<typeof userApiKeySchema>) => void;
  removeApiKey: (key: z.infer<typeof userApiKeySchema>) => void;
  updateApiKey: (uuid: string, key: Partial<z.infer<typeof userApiKeySchema>>) => void;
}

export const createApiKeysSlice: StateCreator<UserStore, [], [], ApiKeySlice> = (set): ApiKeySlice => ({
  apiKeys: getEmptyPaginationSet<z.infer<typeof userApiKeySchema>>(),

  setApiKeys: (value) => set((state) => ({ ...state, apiKeys: value })),
  addApiKey: (key) =>
    set((state) => ({
      apiKeys: {
        ...state.apiKeys,
        data: [...state.apiKeys.data, key],
        total: state.apiKeys.total + 1,
      },
    })),
  removeApiKey: (key) =>
    set((state) => ({
      apiKeys: {
        ...state.apiKeys,
        data: state.apiKeys.data.filter((k) => k.uuid !== key.uuid),
        total: state.apiKeys.total - 1,
      },
    })),
  updateApiKey: (uuid, key) =>
    set((state) => ({
      apiKeys: {
        ...state.apiKeys,
        data: state.apiKeys.data.map((k) => (k.uuid === uuid ? { ...k, ...key } : k)),
      },
    })),
});

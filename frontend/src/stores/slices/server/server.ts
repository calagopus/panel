import { z } from 'zod';
import { StateCreator } from 'zustand';
import { serverImagePullProgressSchema, serverSchema } from '@/lib/schemas/server/server.ts';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { ServerStore } from '@/stores/server.ts';

export interface ServerSlice {
  server: z.infer<typeof serverSchema>;
  commandSnippets: z.infer<typeof userCommandSnippetSchema>[];

  imagePulls: Map<string, z.infer<typeof serverImagePullProgressSchema>>;

  setServer: (server: z.infer<typeof serverSchema>) => void;
  updateServer: (updatedProps: Partial<z.infer<typeof serverSchema>>) => void;

  setCommandSnippets: (snippets: z.infer<typeof userCommandSnippetSchema>[]) => void;

  setImagePull: (id: string, pull: z.infer<typeof serverImagePullProgressSchema>) => void;
  removeImagePull: (id: string) => void;
  clearImagePulls: () => void;
}

export const createServerSlice: StateCreator<ServerStore, [], [], ServerSlice> = (set): ServerSlice => ({
  server: {} as z.infer<typeof serverSchema>,
  commandSnippets: [],

  imagePulls: new Map(),

  setServer: (value) => set((state) => ({ ...state, server: value })),
  updateServer: (updatedProps) =>
    set((state) => ({
      server: { ...state.server, ...updatedProps },
    })),

  setCommandSnippets: (value) => set((state) => ({ ...state, commandSnippets: value })),

  setImagePull: (uuid, progress) =>
    set((state) => {
      const prev = new Map(state.imagePulls);
      prev.set(uuid, progress);
      return { ...state, imagePulls: prev };
    }),
  removeImagePull: (uuid) =>
    set((state) => {
      const prev = new Map(state.imagePulls);
      prev.delete(uuid);
      return { ...state, imagePulls: prev };
    }),
  clearImagePulls: () =>
    set(() => {
      return { imagePulls: new Map<string, z.infer<typeof serverImagePullProgressSchema>>() };
    }),
});

import { z } from 'zod';
import { StateCreator } from 'zustand';
import { serverInstallProgressSchema } from '@/lib/schemas/server/server.ts';
import { ServerStore } from '@/stores/server.ts';

export interface InstallSlice {
  installProgress: z.infer<typeof serverInstallProgressSchema> | null;

  setInstallProgress: (progress: z.infer<typeof serverInstallProgressSchema> | null) => void;
}

export const createInstallSlice: StateCreator<ServerStore, [], [], InstallSlice> = (set): InstallSlice => ({
  installProgress: null,

  setInstallProgress: (progress) => set((state) => ({ ...state, installProgress: progress })),
});

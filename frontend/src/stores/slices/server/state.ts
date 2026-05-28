import { z } from 'zod';
import { StateCreator } from 'zustand';
import { serverPowerState } from '@/lib/schemas/server/server.ts';
import { ServerStore } from '@/stores/server.ts';

export interface StateSlice {
  state: z.infer<typeof serverPowerState>;
  pendingRestart?: boolean;

  setState: (status: z.infer<typeof serverPowerState>) => void;
  setPendingRestart: (pending: boolean) => void;
}

export const createStateSlice: StateCreator<ServerStore, [], [], StateSlice> = (set): StateSlice => ({
  state: 'offline',
  pendingRestart: false,

  setState: (value) => set((state) => ({ ...state, state: value })),
  setPendingRestart: (pending) => set((state) => ({ ...state, pendingRestart: pending })),
});

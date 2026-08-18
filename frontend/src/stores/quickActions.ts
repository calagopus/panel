import { create } from 'zustand';
import type { QuickActionDefinition } from '@/lib/quickActions.ts';

/** Read lazily on every palette render so page actions keep seeing fresh state. */
export type QuickActionProvider = () => QuickActionDefinition[];

export interface QuickActionsStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  pageActions: QuickActionProvider[];
  registerPageActions: (provider: QuickActionProvider) => () => void;
}

export const useQuickActionsStore = create<QuickActionsStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  pageActions: [],
  registerPageActions: (provider) => {
    set((state) => ({ pageActions: [...state.pageActions, provider] }));

    return () => set((state) => ({ pageActions: state.pageActions.filter((p) => p !== provider) }));
  },
}));

export function getQuickActionsStore() {
  return useQuickActionsStore.getState();
}

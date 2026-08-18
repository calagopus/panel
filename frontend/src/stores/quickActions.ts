import { create } from 'zustand';
import type { QuickActionDefinition, QuickActionMode } from '@/lib/quickActions.ts';

/** Read lazily on every palette render so providers keep seeing fresh state. */
export type QuickActionProvider = () => QuickActionDefinition[];
export type QuickActionModeProvider = () => QuickActionMode[];

export interface QuickActionsStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  query: string;
  setQuery: (query: string) => void;
  actions: QuickActionProvider[];
  registerActions: (provider: QuickActionProvider) => () => void;
  modes: QuickActionModeProvider[];
  registerModes: (provider: QuickActionModeProvider) => () => void;
  /** Bumped by a provider's host whenever it re-renders, so the palette picks up async results. */
  revision: number;
  bumpRevision: () => void;
}

export const useQuickActionsStore = create<QuickActionsStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
  query: '',
  setQuery: (query) => set({ query }),
  actions: [],
  registerActions: (provider) => {
    set((state) => ({ actions: [...state.actions, provider] }));

    return () => set((state) => ({ actions: state.actions.filter((p) => p !== provider) }));
  },
  modes: [],
  registerModes: (provider) => {
    set((state) => ({ modes: [...state.modes, provider] }));

    return () => set((state) => ({ modes: state.modes.filter((p) => p !== provider) }));
  },
  revision: 0,
  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),
}));

export function getQuickActionsStore() {
  return useQuickActionsStore.getState();
}

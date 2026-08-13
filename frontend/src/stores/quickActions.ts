import { create } from 'zustand';

export interface QuickActionsStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useQuickActionsStore = create<QuickActionsStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

import { StateCreator } from 'zustand';
import { AdminStore } from '@/stores/admin.tsx';

export type AdminServerModal = 'transfer' | 'suspend' | 'unsuspend' | 'clear-state' | 'delete';

export interface ServerSlice {
  serverModal: AdminServerModal | null;

  doOpenServerModal: (modal: AdminServerModal) => void;
  doCloseServerModal: () => void;
}

export const createServerSlice: StateCreator<AdminStore, [], [], ServerSlice> = (set): ServerSlice => ({
  serverModal: null,

  doOpenServerModal: (modal) => set((state) => (state.serverModal === modal ? state : { serverModal: modal })),
  doCloseServerModal: () => set((state) => (state.serverModal === null ? state : { serverModal: null })),
});

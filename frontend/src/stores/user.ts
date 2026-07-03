import { create } from 'zustand';
import { createServersSlice, ServerSlice } from '@/stores/slices/user/servers.ts';

export interface UserStore extends ServerSlice {}

export const useUserStore = create<UserStore>()((...a) => ({
  ...createServersSlice(...a),
}));

export function getUserStore() {
  return useUserStore.getState();
}

import { create } from 'zustand';
import { createServersSlice, ServerSlice } from '@/stores/slices/user/servers.ts';

export interface UserStore extends ServerSlice {
  reset: () => void;
}

export const useUserStore = create<UserStore>()((...a) => {
  const initialState = {} as UserStore;
  Object.assign(initialState, {
    ...createServersSlice(...a),
  });
  initialState.reset = () => a[0]((state) => ({ ...initialState, reset: state.reset }), true);
  return initialState;
});

export function getUserStore() {
  return useUserStore.getState();
}

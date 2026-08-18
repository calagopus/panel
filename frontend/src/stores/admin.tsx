import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import { createServerSlice, ServerSlice } from '@/stores/slices/admin/server.ts';
import { createSettingsSlice, SettingsSlice } from '@/stores/slices/admin/settings.ts';

export interface AdminStore extends SettingsSlice, ServerSlice {}

const { Provider, useStore } = createContext<StoreApi<AdminStore>>();

export const createAdminStore = () =>
  create<AdminStore>()((...a) => ({
    ...createSettingsSlice(...a),
    ...createServerSlice(...a),
  }));

export const AdminStoreContextProvider = Provider;
export const useAdminStore = useStore;

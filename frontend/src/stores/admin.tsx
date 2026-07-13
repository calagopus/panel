import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import { createSettingsSlice, SettingsSlice } from '@/stores/slices/admin/settings.ts';

export interface AdminStore extends SettingsSlice {}

const { Provider, useStore } = createContext<StoreApi<AdminStore>>();

export const createAdminStore = () =>
  create<AdminStore>()((...a) => ({
    ...createSettingsSlice(...a),
  }));

export const AdminStoreContextProvider = Provider;
export const useAdminStore = useStore;

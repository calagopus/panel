import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import {
  BackupConfigurationsSlice,
  createBackupConfigurationsSlice,
} from '@/stores/slices/admin/backupConfigurations.ts';
import { createDatabaseHostsSlice, DatabaseHostsSlice } from '@/stores/slices/admin/databaseHosts.ts';
import { createEggsSlice, EggsSlice } from '@/stores/slices/admin/eggs.ts';
import { createLocationsSlice, LocationsSlice } from '@/stores/slices/admin/locations.ts';
import { createMountsSlice, MountsSlice } from '@/stores/slices/admin/mounts.ts';
import { createNestsSlice, NestsSlice } from '@/stores/slices/admin/nests.ts';
import { createNodesSlice, NodesSlice } from '@/stores/slices/admin/nodes.ts';
import { createOAuthProvidersSlice, OAuthProvidersSlice } from '@/stores/slices/admin/oauthProviders.ts';
import { createRolesSlice, RolesSlice } from '@/stores/slices/admin/roles.ts';
import { createServersSlice, ServersSlice } from '@/stores/slices/admin/servers.ts';
import { createSettingsSlice, SettingsSlice } from '@/stores/slices/admin/settings.ts';
import { createUsersSlice, UsersSlice } from '@/stores/slices/admin/users.ts';
import { createEggConfigurationsSlice, EggConfigurationsSlice } from './slices/admin/eggConfigurations.ts';
import { createEggRepositoriesSlice, EggRepositoriesSlice } from './slices/admin/eggRepositories.ts';

export interface AdminStore
  extends BackupConfigurationsSlice,
    DatabaseHostsSlice,
    OAuthProvidersSlice,
    EggsSlice,
    LocationsSlice,
    NestsSlice,
    EggConfigurationsSlice,
    EggRepositoriesSlice,
    SettingsSlice,
    UsersSlice,
    NodesSlice,
    RolesSlice,
    ServersSlice,
    MountsSlice {}

const { Provider, useStore } = createContext<StoreApi<AdminStore>>();

export const createAdminStore = () =>
  create<AdminStore>()((...a) => ({
    ...createBackupConfigurationsSlice(...a),
    ...createDatabaseHostsSlice(...a),
    ...createOAuthProvidersSlice(...a),
    ...createEggsSlice(...a),
    ...createLocationsSlice(...a),
    ...createNestsSlice(...a),
    ...createEggConfigurationsSlice(...a),
    ...createEggRepositoriesSlice(...a),
    ...createSettingsSlice(...a),
    ...createUsersSlice(...a),
    ...createNodesSlice(...a),
    ...createRolesSlice(...a),
    ...createServersSlice(...a),
    ...createMountsSlice(...a),
  }));

export const AdminStoreContextProvider = Provider;
export const useAdminStore = useStore;

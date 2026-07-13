import { create, StoreApi } from 'zustand';
import { createContext } from 'zustand-utils';
import { createServerAnnouncementsSlice, ServerAnnouncementsSlice } from '@/stores/slices/server/announcements.ts';
import { BackupsSlice, createBackupsSlice } from '@/stores/slices/server/backups.ts';
import { createFilesSlice, FilesSlice } from '@/stores/slices/server/files.ts';
import { createSchedulesSlice, SchedulesSlice } from '@/stores/slices/server/schedules.ts';
import { createServerSlice, ServerSlice } from '@/stores/slices/server/server.ts';
import { createStartupSlice, StartupSlice } from '@/stores/slices/server/startup.ts';
import { createStateSlice, StateSlice } from '@/stores/slices/server/state.ts';
import { createStatsSlice, StatsSlice } from '@/stores/slices/server/stats.ts';
import { createTransferSlice, TransferSlice } from '@/stores/slices/server/transfer.ts';
import { createWebsocketSlice, WebsocketSlice } from '@/stores/slices/server/websocket.ts';

export interface ServerStore
  extends ServerAnnouncementsSlice,
    BackupsSlice,
    TransferSlice,
    FilesSlice,
    SchedulesSlice,
    ServerSlice,
    StatsSlice,
    StateSlice,
    StartupSlice,
    WebsocketSlice {
  reset: () => void;
}

const { Provider, useStore, useStoreApi } = createContext<StoreApi<ServerStore>>();

export const createServerStore = () =>
  create<ServerStore>()((...a) => {
    const initialState = {} as ServerStore;
    Object.assign(initialState, {
      ...createServerAnnouncementsSlice(...a),
      ...createBackupsSlice(...a),
      ...createTransferSlice(...a),
      ...createFilesSlice(...a),
      ...createSchedulesSlice(...a),
      ...createServerSlice(...a),
      ...createStateSlice(...a),
      ...createStatsSlice(...a),
      ...createStartupSlice(...a),
      ...createWebsocketSlice(...a),
    });
    initialState.reset = () => a[0]((state) => ({ ...initialState, reset: state.reset }), true);
    return initialState;
  });

export const ServerStoreContextProvider = Provider;
export const useServerStore = useStore;
export const useServerStoreApi = useStoreApi;

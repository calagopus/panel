import { z } from 'zod';
import { StateCreator } from 'zustand';
import {
  serverDatabaseInstanceImagePullProgressSchema,
  serverDatabaseInstanceOperationSchema,
  serverDatabaseInstancePowerAction,
  serverDatabaseInstancePowerStateSchema,
  serverDatabaseInstanceResourceUsageSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { ServerStore } from '@/stores/server.ts';

export const FAILED_DATABASE_INSTANCE_OPERATION_LINGER_MS = 5000;

const MAX_LOG_LINES = 4000;
const KEPT_LOG_LINES = 2000;

export interface DatabaseInstancesSlice {
  databaseInstance: z.infer<typeof serverDatabaseInstanceSchema> | null;
  databaseInstanceUsage: z.infer<typeof serverDatabaseInstanceResourceUsageSchema> | null;
  databaseInstanceLogs: string[];
  databaseInstancePowerAction: z.infer<typeof serverDatabaseInstancePowerAction> | null;
  databaseInstanceRestoreProgress: number;
  databaseInstanceRestoreTotal: number;
  databaseInstanceImagePulls: Map<string, z.infer<typeof serverDatabaseInstanceImagePullProgressSchema>>;
  databaseInstanceOperations: Map<string, z.infer<typeof serverDatabaseInstanceOperationSchema>>;
  failedDatabaseInstanceOperations: Map<string, number>;

  _failedDatabaseInstanceOperationTimeouts: Map<string, ReturnType<typeof setTimeout>>;

  setDatabaseInstance: (instance: z.infer<typeof serverDatabaseInstanceSchema>) => void;
  updateDatabaseInstance: (updatedProps: Partial<z.infer<typeof serverDatabaseInstanceSchema>>) => void;
  setDatabaseInstanceUsage: (usage: z.infer<typeof serverDatabaseInstanceResourceUsageSchema>) => void;
  setDatabaseInstanceState: (state: z.infer<typeof serverDatabaseInstancePowerStateSchema>) => void;
  setDatabaseInstancePowerAction: (action: z.infer<typeof serverDatabaseInstancePowerAction> | null) => void;
  setDatabaseInstanceRestoreProgress: (progress: number, total: number) => void;
  addDatabaseInstanceLog: (line: string) => void;
  clearDatabaseInstanceLogs: () => void;

  setDatabaseInstanceImagePull: (
    id: string,
    progress: z.infer<typeof serverDatabaseInstanceImagePullProgressSchema>,
  ) => void;
  removeDatabaseInstanceImagePull: (id: string) => void;

  setDatabaseInstanceOperation: (
    uuid: string,
    operation: z.infer<typeof serverDatabaseInstanceOperationSchema>,
  ) => void;
  failDatabaseInstanceOperation: (uuid: string) => void;
  removeDatabaseInstanceOperation: (uuid: string) => void;

  resetDatabaseInstanceLiveState: () => void;
  clearDatabaseInstance: () => void;
}

export const createDatabaseInstancesSlice: StateCreator<ServerStore, [], [], DatabaseInstancesSlice> = (
  set,
  get,
): DatabaseInstancesSlice => {
  const clearOperationTimeouts = (state: ServerStore) => {
    for (const timeout of state._failedDatabaseInstanceOperationTimeouts.values()) {
      clearTimeout(timeout);
    }

    state._failedDatabaseInstanceOperationTimeouts.clear();
  };

  return {
    databaseInstance: null,
    databaseInstanceUsage: null,
    databaseInstanceLogs: [],
    databaseInstancePowerAction: null,
    databaseInstanceRestoreProgress: 0,
    databaseInstanceRestoreTotal: 0,
    databaseInstanceImagePulls: new Map<string, z.infer<typeof serverDatabaseInstanceImagePullProgressSchema>>(),
    databaseInstanceOperations: new Map<string, z.infer<typeof serverDatabaseInstanceOperationSchema>>(),
    failedDatabaseInstanceOperations: new Map<string, number>(),

    _failedDatabaseInstanceOperationTimeouts: new Map<string, ReturnType<typeof setTimeout>>(),

    setDatabaseInstance: (instance) =>
      set((state) => {
        if (state.databaseInstance?.uuid === instance.uuid) {
          return { ...state, databaseInstance: instance };
        }

        clearOperationTimeouts(state);

        return {
          ...state,
          databaseInstance: instance,
          databaseInstanceUsage: null,
          databaseInstanceLogs: [],
          databaseInstancePowerAction: null,
          databaseInstanceRestoreProgress: 0,
          databaseInstanceRestoreTotal: 0,
          databaseInstanceImagePulls: new Map(),
          databaseInstanceOperations: new Map(),
          failedDatabaseInstanceOperations: new Map(),
        };
      }),
    updateDatabaseInstance: (updatedProps) =>
      set((state) =>
        state.databaseInstance ? { ...state, databaseInstance: { ...state.databaseInstance, ...updatedProps } } : state,
      ),
    setDatabaseInstanceUsage: (usage) =>
      set((state) => ({
        ...state,
        databaseInstanceUsage: usage,
        databaseInstancePowerAction:
          state.databaseInstanceUsage?.state === usage.state ? state.databaseInstancePowerAction : null,
      })),
    setDatabaseInstanceState: (powerState) =>
      set((state) => {
        if (!state.databaseInstanceUsage || state.databaseInstanceUsage.state === powerState) {
          return state;
        }

        return {
          ...state,
          databaseInstanceUsage: { ...state.databaseInstanceUsage, state: powerState },
          databaseInstancePowerAction: null,
        };
      }),
    setDatabaseInstancePowerAction: (action) =>
      set((state) =>
        state.databaseInstancePowerAction === action ? state : { ...state, databaseInstancePowerAction: action },
      ),
    setDatabaseInstanceRestoreProgress: (progress, total) =>
      set((state) => ({ ...state, databaseInstanceRestoreProgress: progress, databaseInstanceRestoreTotal: total })),
    addDatabaseInstanceLog: (line) =>
      set((state) => {
        const lines = [...state.databaseInstanceLogs, line];

        return { ...state, databaseInstanceLogs: lines.length > MAX_LOG_LINES ? lines.slice(-KEPT_LOG_LINES) : lines };
      }),
    clearDatabaseInstanceLogs: () =>
      set((state) => (state.databaseInstanceLogs.length === 0 ? state : { ...state, databaseInstanceLogs: [] })),

    setDatabaseInstanceImagePull: (id, progress) =>
      set((state) => ({
        ...state,
        databaseInstanceImagePulls: new Map(state.databaseInstanceImagePulls).set(id, progress),
      })),
    removeDatabaseInstanceImagePull: (id) =>
      set((state) => {
        if (!state.databaseInstanceImagePulls.has(id)) return state;

        const imagePulls = new Map(state.databaseInstanceImagePulls);
        imagePulls.delete(id);

        return { ...state, databaseInstanceImagePulls: imagePulls };
      }),

    setDatabaseInstanceOperation: (uuid, operation) =>
      set((state) => {
        if (state.failedDatabaseInstanceOperations.has(uuid)) return state;

        return { ...state, databaseInstanceOperations: new Map(state.databaseInstanceOperations).set(uuid, operation) };
      }),
    failDatabaseInstanceOperation: (uuid) => {
      const state = get();
      if (!state.databaseInstanceOperations.has(uuid) || state.failedDatabaseInstanceOperations.has(uuid)) return;

      state._failedDatabaseInstanceOperationTimeouts.set(
        uuid,
        setTimeout(() => get().removeDatabaseInstanceOperation(uuid), FAILED_DATABASE_INSTANCE_OPERATION_LINGER_MS),
      );

      set((s) => ({
        ...s,
        failedDatabaseInstanceOperations: new Map(s.failedDatabaseInstanceOperations).set(uuid, Date.now()),
      }));
    },
    removeDatabaseInstanceOperation: (uuid) =>
      set((state) => {
        const timeout = state._failedDatabaseInstanceOperationTimeouts.get(uuid);
        if (timeout) {
          clearTimeout(timeout);
          state._failedDatabaseInstanceOperationTimeouts.delete(uuid);
        }

        const operations = new Map(state.databaseInstanceOperations);
        operations.delete(uuid);

        if (!state.failedDatabaseInstanceOperations.has(uuid)) {
          return { ...state, databaseInstanceOperations: operations };
        }

        const failedOperations = new Map(state.failedDatabaseInstanceOperations);
        failedOperations.delete(uuid);

        return {
          ...state,
          databaseInstanceOperations: operations,
          failedDatabaseInstanceOperations: failedOperations,
        };
      }),

    resetDatabaseInstanceLiveState: () =>
      set((state) => {
        clearOperationTimeouts(state);

        return {
          ...state,
          databaseInstanceUsage: null,
          databaseInstancePowerAction: null,
          databaseInstanceImagePulls: new Map(),
          databaseInstanceOperations: new Map(),
          failedDatabaseInstanceOperations: new Map(),
        };
      }),
    clearDatabaseInstance: () =>
      set((state) => {
        clearOperationTimeouts(state);

        return {
          ...state,
          databaseInstance: null,
          databaseInstanceUsage: null,
          databaseInstanceLogs: [],
          databaseInstancePowerAction: null,
          databaseInstanceRestoreProgress: 0,
          databaseInstanceRestoreTotal: 0,
          databaseInstanceImagePulls: new Map(),
          databaseInstanceOperations: new Map(),
          failedDatabaseInstanceOperations: new Map(),
        };
      }),
  };
};

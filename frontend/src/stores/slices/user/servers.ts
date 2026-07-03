import { z } from 'zod';
import { StateCreator } from 'zustand';
import getNodeResources from '@/api/me/servers/nodes/getNodeResources.ts';
import { serverResourceUsageSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { UserStore } from '@/stores/user.ts';

const CACHE_TTL_MS = 1000 * 30;
const POLL_INTERVAL_MS = 30500;

export interface ServerSlice {
  serverGroups: z.infer<typeof userServerGroupSchema>[];

  serverResourceUsage: Record<string, z.infer<typeof serverResourceUsageSchema>>;
  resourceUsageTick: number;

  _nodeFetchTimestamps: Map<string, number>;
  _pendingNodeFetches: Map<string, Promise<void>>;
  _nodeSubscribers: Map<string, number>;
  _nodeIntervals: Map<string, ReturnType<typeof setInterval>>;

  setServerGroups: (serverGroups: z.infer<typeof userServerGroupSchema>[]) => void;
  addServerGroup: (serverGroup: z.infer<typeof userServerGroupSchema>) => void;
  removeServerGroup: (serverGroup: z.infer<typeof userServerGroupSchema>) => void;
  updateServerGroup: (uuid: string, data: { name?: string; serverOrder?: string[] }) => void;

  addServerResourceUsage: (serverUuid: string, usage: z.infer<typeof serverResourceUsageSchema>) => void;
  getServerResourceUsage: (uuid: string) => z.infer<typeof serverResourceUsageSchema> | undefined;
  fetchNodeResources: (nodeUuid: string) => Promise<void>;
  subscribeToNode: (nodeUuid: string) => () => void;
}

export const createServersSlice: StateCreator<UserStore, [], [], ServerSlice> = (set, get) => ({
  serverGroups: [],

  serverResourceUsage: {},
  resourceUsageTick: 0,

  _nodeFetchTimestamps: new Map(),
  _pendingNodeFetches: new Map(),
  _nodeSubscribers: new Map(),
  _nodeIntervals: new Map(),

  setServerGroups: (value) => set({ serverGroups: value }),
  addServerGroup: (serverGroup) => set((state) => ({ serverGroups: [...state.serverGroups, serverGroup] })),
  removeServerGroup: (serverGroup) =>
    set((state) => ({
      serverGroups: state.serverGroups.filter((g) => g.uuid !== serverGroup.uuid),
    })),
  updateServerGroup: (uuid, data) =>
    set((state) => ({
      serverGroups: state.serverGroups.map((g) => (g.uuid === uuid ? { ...g, ...data } : g)),
    })),

  addServerResourceUsage: (serverUuid, usage) => {
    set((state) => ({
      serverResourceUsage: { ...state.serverResourceUsage, [serverUuid]: usage },
      resourceUsageTick: state.resourceUsageTick + 1,
    }));
  },

  getServerResourceUsage: (uuid) => {
    return get().serverResourceUsage[uuid];
  },

  fetchNodeResources: async (nodeUuid) => {
    const state = get();
    const now = Date.now();

    const lastFetch = state._nodeFetchTimestamps.get(nodeUuid) || 0;
    if (now - lastFetch < CACHE_TTL_MS) {
      return;
    }

    if (state._pendingNodeFetches.has(nodeUuid)) {
      return state._pendingNodeFetches.get(nodeUuid);
    }

    const fetchPromise = (async () => {
      try {
        const usages = await getNodeResources(nodeUuid);

        set((s) => {
          const updated = { ...s.serverResourceUsage };
          for (const [serverId, resources] of Object.entries(usages)) {
            updated[serverId] = resources;
          }

          const timestamps = new Map(s._nodeFetchTimestamps);
          timestamps.set(nodeUuid, Date.now());

          return {
            serverResourceUsage: updated,
            _nodeFetchTimestamps: timestamps,
            resourceUsageTick: s.resourceUsageTick + 1,
          };
        });
      } catch (err) {
        console.error(`Failed to fetch resources for node ${nodeUuid}:`, err);
      } finally {
        get()._pendingNodeFetches.delete(nodeUuid);
      }
    })();

    state._pendingNodeFetches.set(nodeUuid, fetchPromise);
    return fetchPromise;
  },

  subscribeToNode: (nodeUuid) => {
    const state = get();
    const current = state._nodeSubscribers.get(nodeUuid) || 0;
    state._nodeSubscribers.set(nodeUuid, current + 1);

    if (current === 0) {
      get().fetchNodeResources(nodeUuid);

      const intervalId = setInterval(() => {
        get().fetchNodeResources(nodeUuid);
      }, POLL_INTERVAL_MS);

      state._nodeIntervals.set(nodeUuid, intervalId);
    }

    return () => {
      const s = get();
      const count = (s._nodeSubscribers.get(nodeUuid) || 1) - 1;

      if (count <= 0) {
        s._nodeSubscribers.delete(nodeUuid);
        const interval = s._nodeIntervals.get(nodeUuid);
        if (interval) {
          clearInterval(interval);
          s._nodeIntervals.delete(nodeUuid);
        }
      } else {
        s._nodeSubscribers.set(nodeUuid, count);
      }
    };
  },
});

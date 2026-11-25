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
  failedResourceNodes: Record<string, true>;

  _nodeFetchTimestamps: Map<string, number>;
  _pendingNodeFetches: Map<string, Promise<void>>;
  _nodeSubscribers: Map<string, number>;
  _nodePollStops: Map<string, () => void>;

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
  failedResourceNodes: {},

  _nodeFetchTimestamps: new Map(),
  _pendingNodeFetches: new Map(),
  _nodeSubscribers: new Map(),
  _nodePollStops: new Map(),

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

          const { [nodeUuid]: _, ...failedResourceNodes } = s.failedResourceNodes;

          return {
            serverResourceUsage: updated,
            _nodeFetchTimestamps: timestamps,
            resourceUsageTick: s.resourceUsageTick + 1,
            ...(nodeUuid in s.failedResourceNodes ? { failedResourceNodes } : {}),
          };
        });
      } catch (err) {
        console.error(`Failed to fetch resources for node ${nodeUuid}:`, err);

        if (!(nodeUuid in get().failedResourceNodes)) {
          set((s) => ({ failedResourceNodes: { ...s.failedResourceNodes, [nodeUuid]: true } }));
        }
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

      const poll = () => {
        if (!document.hidden) get().fetchNodeResources(nodeUuid);
      };
      const intervalId = setInterval(poll, POLL_INTERVAL_MS);
      document.addEventListener('visibilitychange', poll);

      state._nodePollStops.set(nodeUuid, () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', poll);
      });
    }

    return () => {
      const s = get();
      const count = (s._nodeSubscribers.get(nodeUuid) || 1) - 1;

      if (count <= 0) {
        s._nodeSubscribers.delete(nodeUuid);
        s._nodePollStops.get(nodeUuid)?.();
        s._nodePollStops.delete(nodeUuid);
      } else {
        s._nodeSubscribers.set(nodeUuid, count);
      }
    };
  },
});

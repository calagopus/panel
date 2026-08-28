import {
  Active,
  CollisionDetection,
  closestCenter,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  getFirstCollision,
  Over,
  pointerWithin,
  rectIntersection,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { getUserStore, useUserStore } from '@/stores/user.ts';

export const SERVER_GROUPS_CONTAINER_ID = 'server-groups';
export const SERVER_GROUPS_EXPANDED_KEY = 'dashboard::server_groups_expanded';
export const MAX_SERVERS_PER_GROUP = 100;

export type ServerGroupDropBlockReason = 'alreadyInGroup' | 'groupFull';

type ServerGroup = z.infer<typeof userServerGroupSchema>;
type Server = z.infer<typeof serverSchema>;

const expandedMapSchema = z.record(z.string(), z.boolean());
const emptyExpandedMap: Record<string, boolean> = {};

export function serverDndId(groupUuid: string, serverUuid: string) {
  return `${groupUuid}:${serverUuid}`;
}

function parseServerDndId(id: UniqueIdentifier) {
  const [groupUuid, serverUuid] = String(id).split(':');

  return serverUuid ? { groupUuid, serverUuid } : null;
}

function sortableItemIds(item: Active | Over): string[] {
  const items = item.data.current?.sortable?.items;

  return Array.isArray(items) ? items.map(String) : [];
}

export function serverGroupDropBlockReason(
  serverGroup: ServerGroup,
  serverUuid: string,
): ServerGroupDropBlockReason | null {
  if (serverGroup.serverOrder.includes(serverUuid)) return 'alreadyInGroup';
  if (serverGroup.serverOrder.length >= MAX_SERVERS_PER_GROUP) return 'groupFull';

  return null;
}

export function useServerGroupsDnd({
  onGroupsReorder,
}: {
  onGroupsReorder?: (serverGroups: ServerGroup[]) => void | Promise<void>;
} = {}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);
  const [expandedMap] = useUserSetting(SERVER_GROUPS_EXPANDED_KEY, expandedMapSchema, emptyExpandedMap);

  const [activeServerGroup, setActiveServerGroup] = useState<ServerGroup | null>(null);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [activeServerDndId, setActiveServerDndId] = useState<string | null>(null);
  const [activeServerSourceUuid, setActiveServerSourceUuid] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ groupUuid: string; server: Server } | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<{
    groupUuid: string;
    reason: ServerGroupDropBlockReason;
  } | null>(null);
  const [placement, setPlacement] = useState<{ groupUuid: string; index: number } | null>(null);

  const activeKind = useRef<'group' | 'server' | null>(null);
  const activeDndId = useRef<string | null>(null);
  const activeSource = useRef<string | null>(null);
  const activeContainer = useRef<string | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyReparented = useRef(false);

  const groupUuids = useMemo(() => new Set(serverGroups.map((g) => g.uuid)), [serverGroups]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyReparented.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [placement]);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (activeKind.current === 'group') {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) => groupUuids.has(String(container.id))),
        });
      }

      const pointerCollisions = pointerWithin(args);
      const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      const overId = collisions.find((c) => !groupUuids.has(String(c.id)))?.id ?? getFirstCollision(collisions, 'id');

      if (overId != null) {
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      if (recentlyReparented.current) {
        lastOverId.current = activeDndId.current;
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [groupUuids],
  );

  const describeItem = useCallback(
    (item: Active | Over) => {
      const serverGroup = serverGroups.find((g) => g.uuid === String(item.id));
      if (serverGroup) return serverGroup.name;

      const server = item.data.current?.server as Server | undefined;

      return server?.name ?? String(item.id);
    },
    [serverGroups],
  );

  const resetDragState = useCallback(() => {
    activeKind.current = null;
    activeDndId.current = null;
    activeSource.current = null;
    activeContainer.current = null;
    lastOverId.current = null;
    recentlyReparented.current = false;

    setActiveServerGroup(null);
    setActiveServer(null);
    setActiveServerDndId(null);
    setActiveServerSourceUuid(null);
    setBlockedTarget(null);
    setPlacement(null);
  }, []);

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setBlockedTarget(null);
      setPlacement(null);
      lastOverId.current = null;
      recentlyReparented.current = false;

      if (active.data.current?.sortable?.containerId === SERVER_GROUPS_CONTAINER_ID) {
        activeKind.current = 'group';
        activeDndId.current = String(active.id);
        setActiveServer(null);
        setActiveServerDndId(null);
        setActiveServerSourceUuid(null);
        setActiveServerGroup(serverGroups.find((g) => g.uuid === String(active.id)) ?? null);
        return;
      }

      const dragged = parseServerDndId(active.id);
      activeKind.current = 'server';
      activeDndId.current = String(active.id);
      activeSource.current = dragged?.groupUuid ?? null;
      activeContainer.current = dragged?.groupUuid ?? null;

      setActiveServerGroup(null);
      setActiveServer((active.data.current?.server as Server | undefined) ?? null);
      setActiveServerDndId(String(active.id));
      setActiveServerSourceUuid(dragged?.groupUuid ?? null);
    },
    [serverGroups],
  );

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (activeKind.current !== 'server' || !over) return;

      const dragged = parseServerDndId(active.id);
      if (!dragged) return;

      const overIsGroup = groupUuids.has(String(over.id));
      const overContainer = overIsGroup
        ? String(over.id)
        : String(over.id) === activeDndId.current
          ? activeContainer.current
          : ((over.data.current?.sortable?.containerId as string | undefined) ?? null);

      if (!overContainer || overContainer === activeContainer.current) return;

      const target = serverGroups.find((g) => g.uuid === overContainer);
      if (!target) return;

      const returningHome = target.uuid === activeSource.current;
      const reason = returningHome ? null : serverGroupDropBlockReason(target, dragged.serverUuid);

      if (reason || (!returningHome && expandedMap[target.uuid] === false)) {
        setBlockedTarget(reason ? { groupUuid: target.uuid, reason } : null);
        return;
      }

      const overItems = sortableItemIds(over);
      const overIndex = overIsGroup ? -1 : ((over.data.current?.sortable?.index as number | undefined) ?? -1);
      const draggedRect = active.rect.current.translated;
      const isBelowOverItem = !overIsGroup && !!draggedRect && draggedRect.top > over.rect.top + over.rect.height / 2;

      activeContainer.current = target.uuid;
      recentlyReparented.current = true;

      setBlockedTarget(null);
      setPlacement({
        groupUuid: target.uuid,
        index: overIndex >= 0 ? overIndex + (isBelowOverItem ? 1 : 0) : overItems.length,
      });
    },
    [expandedMap, groupUuids, serverGroups],
  );

  const reorderWithinGroup = useCallback(
    async (groupUuid: string, orderedServerUuids: string[]) => {
      const serverGroup = getUserStore().serverGroups.find((g) => g.uuid === groupUuid);
      if (!serverGroup) return;

      const previousOrder = serverGroup.serverOrder;
      const serverOrder = [...previousOrder];
      const knownUuids = new Set(serverOrder);
      const draggedUuids = orderedServerUuids.filter((uuid) => knownUuids.has(uuid));
      const positions = draggedUuids.map((uuid) => serverOrder.indexOf(uuid)).sort((a, b) => a - b);
      positions.forEach((position, i) => {
        serverOrder[position] = draggedUuids[i];
      });

      updateStateServerGroup(groupUuid, { serverOrder });

      await updateServerGroup(groupUuid, { serverOrder }).catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        updateStateServerGroup(groupUuid, { serverOrder: previousOrder });
      });
    },
    [addToast, updateStateServerGroup],
  );

  const moveBetweenGroups = useCallback(
    async (sourceUuid: string, targetUuid: string, server: Server, beforeServerUuid: string | null) => {
      const serverUuid = server.uuid;

      const { serverGroups: current } = getUserStore();
      const source = current.find((g) => g.uuid === sourceUuid);
      const target = current.find((g) => g.uuid === targetUuid);
      if (!source || !target || serverGroupDropBlockReason(target, serverUuid)) return;

      const previousSourceOrder = source.serverOrder;
      const previousTargetOrder = target.serverOrder;

      const targetOrder = [...previousTargetOrder];
      const insertAt = beforeServerUuid ? targetOrder.indexOf(beforeServerUuid) : -1;
      if (insertAt === -1) {
        targetOrder.push(serverUuid);
      } else {
        targetOrder.splice(insertAt, 0, serverUuid);
      }
      const sourceOrder = previousSourceOrder.filter((uuid) => uuid !== serverUuid);

      setPendingMove({ groupUuid: targetUuid, server });
      updateStateServerGroup(targetUuid, { serverOrder: targetOrder });
      updateStateServerGroup(sourceUuid, { serverOrder: sourceOrder });

      try {
        await updateServerGroup(targetUuid, { serverOrder: targetOrder });
        await updateServerGroup(sourceUuid, { serverOrder: sourceOrder });

        addToast(t('pages.account.home.tabs.groupedServers.page.drag.toast.moved', { group: target.name }), 'success');
      } catch (err) {
        addToast(httpErrorToHuman(err), 'error');

        await getServerGroups()
          .then(setServerGroups)
          .catch(() => {
            updateStateServerGroup(targetUuid, { serverOrder: previousTargetOrder });
            updateStateServerGroup(sourceUuid, { serverOrder: previousSourceOrder });
          });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKeys.user.servers.all(), sourceUuid] }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.user.servers.all(), targetUuid] }),
      ]);

      setPendingMove(null);
    },
    [addToast, queryClient, setServerGroups, t, updateStateServerGroup],
  );

  const onDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      const kind = activeKind.current;
      const sourceUuid = activeSource.current;
      const containerUuid = activeContainer.current;
      const draggedDndId = activeDndId.current;
      const server = activeServer;

      resetDragState();

      if (kind === 'group') {
        if (!onGroupsReorder || !over || active.id === over.id) return;

        const ids = sortableItemIds(active);
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(ids, oldIndex, newIndex)
          .map((uuid) => serverGroups.find((g) => g.uuid === uuid))
          .filter((g) => !!g);
        if (reordered.length !== ids.length) return;

        await onGroupsReorder(reordered);
        return;
      }

      if (kind !== 'server' || !sourceUuid || !containerUuid || !draggedDndId || !server) return;

      if (containerUuid === sourceUuid) {
        if (!over || active.id === over.id) return;

        const ids = sortableItemIds(active);
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedUuids: string[] = [];
        for (const id of arrayMove(ids, oldIndex, newIndex)) {
          const uuid = parseServerDndId(id)?.serverUuid;
          if (uuid) reorderedUuids.push(uuid);
        }

        await reorderWithinGroup(sourceUuid, reorderedUuids);
        return;
      }

      let finalOrder = over ? sortableItemIds(over) : [];
      if (over && !groupUuids.has(String(over.id))) {
        const from = finalOrder.indexOf(draggedDndId);
        const to = finalOrder.indexOf(String(over.id));
        if (from !== -1 && to !== -1) finalOrder = arrayMove(finalOrder, from, to);
      }

      const droppedAt = finalOrder.indexOf(draggedDndId);
      const before = droppedAt === -1 ? null : (parseServerDndId(finalOrder[droppedAt + 1] ?? '')?.serverUuid ?? null);

      await moveBetweenGroups(sourceUuid, containerUuid, server, before);
    },
    [activeServer, groupUuids, moveBetweenGroups, onGroupsReorder, reorderWithinGroup, resetDragState, serverGroups],
  );

  const onDragCancel = useCallback(() => resetDragState(), [resetDragState]);

  return {
    collisionDetection,
    describeItem,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
    activeServerGroup,
    activeServer,
    activeServerDndId,
    activeServerSourceUuid,
    blockedTarget,
    placement,
    pendingMove,
  };
}

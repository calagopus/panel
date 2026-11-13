import { faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, memo, startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import updateServerGroupsOrder from '@/api/me/servers/groups/updateServerGroupsOrder.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { DndBoard, DndSortableList, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useSelectKeyHeld } from '@/plugins/selection/useSelectKeyHeld.ts';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { SERVER_GROUPS_CONTAINER_ID, useServerGroupsDnd } from '@/plugins/server/useServerGroupsDnd.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useUserStore } from '@/stores/user.ts';
import BulkActionBar from './BulkActionBar.tsx';
import DashboardHomeTitle from './DashboardHomeTitle.tsx';
import ServerGroupCreateModal from './modals/ServerGroupCreateModal.tsx';
import ServerGroupItem from './ServerGroupItem.tsx';
import ServerItem from './ServerItem.tsx';

const MemoizedServerGroupItem = memo(ServerGroupItem);
const MemoizedServerItem = memo(ServerItem);

export default function DashboardHomeGrouped() {
  const { t } = useTranslations();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const maxServerGroupCount = useGlobalStore((state) => state.settings.user.maxServerGroupCount);
  const { addToast } = useToast();

  const [selectedServers, setSelectedServers] = useState(new ObjectSet<z.infer<typeof serverSchema>, 'uuid'>('uuid'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const sKeyPressedRef = useSelectKeyHeld();

  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  const loadGroups = () => {
    setLoading(true);
    setError(null);

    getServerGroups()
      .then((response) => {
        setServerGroups(response);
      })
      .catch((msg) => {
        setError(msg);
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(loadGroups, [addToast, setServerGroups]);

  const handleServerSelectionChange = useCallback((server: z.infer<typeof serverSchema>, selected: boolean) => {
    setSelectedServers((prev) => {
      const newSet = prev.clone();
      if (selected) {
        newSet.add(server);
      } else {
        newSet.delete(server);
      }
      return newSet;
    });
  }, []);

  const handleServersSelectionChange = useCallback((servers: z.infer<typeof serverSchema>[], selected: boolean) => {
    setSelectedServers((previous) => {
      const next = previous.clone();
      for (const server of servers) {
        if (selected) {
          next.add(server);
        } else {
          next.delete(server);
        }
      }
      return next;
    });
  }, []);

  const handleServerClick = useCallback((server: z.infer<typeof serverSchema>, event: React.MouseEvent) => {
    if (sKeyPressedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      setSelectedServers((prev) => {
        const newSet = prev.clone();
        if (!newSet.delete(server)) {
          newSet.add(server);
        }
        return newSet;
      });
    }
  }, []);

  const onBulkAction = async (action: z.infer<typeof serverPowerAction>) => {
    await handleBulkPowerAction(selectedServers.keys(), action);
    setSelectedServers(new ObjectSet('uuid'));
  };

  const sortedServerGroups = useMemo(() => [...serverGroups].sort((a, b) => a.order - b.order), [serverGroups]);

  const serverGroupUuids = useMemo(() => sortedServerGroups.map((g) => g.uuid), [sortedServerGroups]);

  const onGroupsReorder = useCallback(
    async (reordered: z.infer<typeof userServerGroupSchema>[]) => {
      const previousServerGroups = serverGroups;

      startTransition(() => {
        setServerGroups(reordered.map((g, i) => ({ ...g, order: i })));
      });

      await updateServerGroupsOrder(reordered.map((g) => g.uuid)).catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setServerGroups(previousServerGroups);
      });
    },
    [addToast, serverGroups, setServerGroups],
  );

  const {
    collisionDetection,
    describeItem,
    activeServerGroup,
    activeServer,
    activeServerDndId,
    activeServerSourceUuid,
    blockedTarget,
    placement,
    pendingMove,
    ...dndHandlers
  } = useServerGroupsDnd({ onGroupsReorder });

  const atGroupLimit = serverGroups.length >= maxServerGroupCount;

  const createGroupButton = (
    <ConditionalTooltip
      enabled={atGroupLimit}
      label={t('pages.account.home.tabs.groupedServers.page.tooltip.limitReached', { max: maxServerGroupCount })}
    >
      <Button
        onClick={() => setOpenModal('create')}
        disabled={atGroupLimit}
        color='blue'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
      >
        {t('pages.account.home.tabs.groupedServers.page.button.createGroup', {})}
      </Button>
    </ConditionalTooltip>
  );

  return (
    <AccountContentContainer
      title={t('pages.account.home.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.home.containerGrouped}
    >
      <ServerGroupCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <DashboardHomeTitle />

      <BulkActionBar
        selectedCount={selectedServers.size}
        onClear={() => setSelectedServers(new ObjectSet('uuid'))}
        onAction={onBulkAction}
        loading={bulkActionLoading}
      />

      {loading ? (
        <Spinner.Centered />
      ) : error ? (
        <ErrorState error={httpErrorToHuman(error)} onRetry={loadGroups} />
      ) : serverGroups.length === 0 ? (
        <EmptyState
          icon={faLayerGroup}
          title={t('pages.account.home.tabs.groupedServers.page.empty.title', {})}
          description={t('pages.account.home.tabs.groupedServers.page.empty.description', {})}
        >
          {createGroupButton}
        </EmptyState>
      ) : (
        <DndBoard
          collisionDetection={collisionDetection}
          describeItem={describeItem}
          {...dndHandlers}
          renderOverlay={() =>
            activeServerGroup ? (
              <div style={{ cursor: 'grabbing', opacity: 0.95 }} className='shadow-xl rounded-lg'>
                <MemoizedServerGroupItem
                  serverGroup={activeServerGroup}
                  dragHandleProps={{
                    style: { cursor: 'grabbing' },
                  }}
                  sKeyPressedRef={sKeyPressedRef}
                />
              </div>
            ) : activeServer ? (
              <div style={{ cursor: 'grabbing' }} className='shadow-xl rounded-xl'>
                <MemoizedServerItem
                  server={activeServer}
                  showContextMenu
                  showForeignServerBadge
                  isSelected={selectedServers.has(activeServer)}
                  onGroupRemove={() => null}
                />
              </div>
            ) : null
          }
        >
          <DndSortableList id={SERVER_GROUPS_CONTAINER_ID} items={serverGroupUuids}>
            <div className='flex flex-col gap-3'>
              {sortedServerGroups.map((serverGroup) => (
                <SortableItem
                  key={serverGroup.uuid}
                  id={serverGroup.uuid}
                  renderItem={({ dragHandleProps }) => (
                    <MemoizedServerGroupItem
                      serverGroup={serverGroup}
                      dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                      selectedServers={selectedServers}
                      onServerSelectionChange={handleServerSelectionChange}
                      onServersSelectionChange={handleServersSelectionChange}
                      onServerClick={handleServerClick}
                      sKeyPressedRef={sKeyPressedRef}
                      isDropTarget={
                        blockedTarget?.groupUuid === serverGroup.uuid || placement?.groupUuid === serverGroup.uuid
                      }
                      dropBlockedReason={blockedTarget?.groupUuid === serverGroup.uuid ? blockedTarget.reason : null}
                      adoptedServer={placement?.groupUuid === serverGroup.uuid ? activeServer : null}
                      adoptedDndId={placement?.groupUuid === serverGroup.uuid ? activeServerDndId : null}
                      adoptedIndex={placement?.groupUuid === serverGroup.uuid ? placement.index : null}
                      hiddenDndId={placement && activeServerSourceUuid === serverGroup.uuid ? activeServerDndId : null}
                      pendingServer={pendingMove?.groupUuid === serverGroup.uuid ? pendingMove.server : null}
                    />
                  )}
                />
              ))}
            </div>
          </DndSortableList>
        </DndBoard>
      )}

      {serverGroups.length > 0 && <div className='flex justify-center mt-4'>{createGroupButton}</div>}
    </AccountContentContainer>
  );
}

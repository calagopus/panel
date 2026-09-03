import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import updateServerGroupsOrder from '@/api/me/servers/groups/updateServerGroupsOrder.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { DndBoard, DndSortableList, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { SERVER_GROUPS_CONTAINER_ID, useServerGroupsDnd } from '@/plugins/server/useServerGroupsDnd.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
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
  const { addToast } = useToast();

  const [selectedServers, setSelectedServers] = useState(new ObjectSet<z.infer<typeof serverSchema>, 'uuid'>('uuid'));
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const sKeyPressedRef = useRef(false);

  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  useEffect(() => {
    getServerGroups()
      .then((response) => {
        setServerGroups(response);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addToast, setServerGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          sKeyPressedRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        sKeyPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
      ) : serverGroups.length === 0 ? (
        <p className='text-gray-400 light:text-gray-600!'>
          {t('pages.account.home.tabs.groupedServers.page.noGroups', {})}
        </p>
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

      <div className='flex justify-center mt-4'>
        <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('pages.account.home.tabs.groupedServers.page.button.createGroup', {})}
        </Button>
      </div>
    </AccountContentContainer>
  );
}

import { rectSortingStrategy } from '@dnd-kit/sortable';
import {
  faChevronRight,
  faCircleExclamation,
  faEllipsisVertical,
  faGripVertical,
  faPen,
  faPlus,
  faPowerOff,
  faSearch,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import deleteServerGroup from '@/api/me/servers/groups/deleteServerGroup.ts';
import getServerGroupServers from '@/api/me/servers/groups/getServerGroupServers.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import { Pagination } from '@/elements/data-display/Table.tsx';
import { DndSortableList, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import BlockedOverlay from '@/elements/feedback/BlockedOverlay.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Collapse from '@/elements/layout/Collapse.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Menu from '@/elements/overlays/Menu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import { useUserSettingMapEntry } from '@/lib/userSettings.ts';
import ServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { MAX_SERVERS_PER_GROUP, ServerGroupDropBlockReason, serverDndId } from '@/plugins/server/useServerGroupsDnd.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import GroupAddServerModal from './modals/GroupAddServerModal.tsx';
import ServerGroupEditModal from './modals/ServerGroupEditModal.tsx';

const expandedSchema = z.boolean();

const MemoizedServerItem = memo(ServerItem);

function ServerGroupServerRow({
  server,
  to,
  isSelected,
  onServerSelectionChange,
  onServerClick,
  sKeyPressedRef,
  onRemoveRequested,
}: {
  server: z.infer<typeof serverSchema>;
  to?: string;
  isSelected?: boolean;
  onServerSelectionChange?: (server: z.infer<typeof serverSchema>, selected: boolean) => void;
  onServerClick?: (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => void;
  sKeyPressedRef: React.RefObject<boolean>;
  onRemoveRequested: (server: z.infer<typeof serverSchema>) => void;
}) {
  const handleSelectionChange = useCallback(
    (selected: boolean) => onServerSelectionChange?.(server, selected),
    [onServerSelectionChange, server],
  );
  const handleClick = useCallback((event: React.MouseEvent) => onServerClick?.(server, event), [onServerClick, server]);
  const handleGroupRemove = useCallback(() => onRemoveRequested(server), [onRemoveRequested, server]);

  return (
    <MemoizedServerItem
      server={server}
      to={to}
      showContextMenu
      isSelected={isSelected}
      onSelectionChange={onServerSelectionChange ? handleSelectionChange : undefined}
      showForeignServerBadge
      onClick={onServerClick ? handleClick : undefined}
      onGroupRemove={handleGroupRemove}
      sKeyPressedRef={sKeyPressedRef}
    />
  );
}

export default function ServerGroupItem({
  serverGroup,
  dragHandleProps,
  selectedServers,
  onServerSelectionChange,
  onServerClick,
  sKeyPressedRef,
  getServerTo,
  isDropTarget = false,
  dropBlockedReason = null,
  adoptedServer = null,
  adoptedDndId = null,
  adoptedIndex = null,
  hiddenDndId = null,
  pendingServer = null,
}: {
  serverGroup: z.infer<typeof userServerGroupSchema>;
  dragHandleProps?: ComponentProps<'button'>;
  selectedServers?: ObjectSet<z.infer<typeof serverSchema>, 'uuid'>;
  onServerSelectionChange?: (server: z.infer<typeof serverSchema>, selected: boolean) => void;
  onServerClick?: (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => void;
  sKeyPressedRef: React.RefObject<boolean>;
  getServerTo?: (server: z.infer<typeof serverSchema>) => string;
  isDropTarget?: boolean;
  dropBlockedReason?: ServerGroupDropBlockReason | null;
  adoptedServer?: z.infer<typeof serverSchema> | null;
  adoptedDndId?: string | null;
  adoptedIndex?: number | null;
  hiddenDndId?: string | null;
  pendingServer?: z.infer<typeof serverSchema> | null;
}) {
  const { t, tItem } = useTranslations();
  const updateStateServerGroup = useUserStore((state) => state.updateServerGroup);
  const removeServerGroup = useUserStore((state) => state.removeServerGroup);
  const { addToast } = useToast();
  const isDark = useComputedColorScheme('dark') === 'dark';

  const [isExpanded, setIsExpanded] = useUserSettingMapEntry(
    'dashboard::server_groups_expanded',
    serverGroup.uuid,
    expandedSchema,
    true,
  );
  const [servers, setServers] = useState(getEmptyPaginationSet<z.infer<typeof serverSchema>>());
  const [openModal, setOpenModal] = useState<'edit' | 'delete' | 'add-server' | 'remove-server' | null>(null);
  const [serverToRemove, setServerToRemove] = useState<{
    server: z.infer<typeof serverSchema>;
  } | null>(null);

  const { handleBulkPowerAction, bulkActionLoading: groupActionLoading } = useBulkPowerActions();

  const { loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: [...queryKeys.user.servers.all(), serverGroup.uuid],
    fetcher: (page, search) => getServerGroupServers(serverGroup.uuid, page, search),
    setStoreData: setServers,
    modifyParams: false,
  });

  const doDelete = async () => {
    await deleteServerGroup(serverGroup.uuid)
      .then(() => {
        setOpenModal(null);
        removeServerGroup(serverGroup);
        addToast(t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.toast.deleted', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const handleGroupPowerAction = async (action: z.infer<typeof serverPowerAction>) => {
    await handleBulkPowerAction(serverGroup.serverOrder, action);
  };

  const doRemoveServer = async () => {
    if (!serverToRemove) {
      return;
    }

    const { server } = serverToRemove;

    const previousServers = servers;
    const serverOrder = serverGroup.serverOrder.filter((uuid) => uuid !== server.uuid);
    updateStateServerGroup(serverGroup.uuid, { serverOrder });
    setServers((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      data: prev.data.filter((s) => s.uuid !== server.uuid),
    }));

    await updateServerGroup(serverGroup.uuid, { serverOrder })
      .then(() => {
        setOpenModal(null);
        refetch();
        addToast(
          t('pages.account.home.tabs.groupedServers.page.modal.removeServerFromGroup.toast.removed', {}),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
        updateStateServerGroup(serverGroup.uuid, { serverOrder: serverGroup.serverOrder });
        setServers(previousServers);
      });
  };

  const orderedServers = useMemo(() => {
    const positions = new Map(serverGroup.serverOrder.map((uuid, i) => [uuid, i]));
    const data =
      pendingServer && !servers.data.some((s) => s.uuid === pendingServer.uuid)
        ? [...servers.data, pendingServer]
        : servers.data;

    return data
      .filter((s) => positions.has(s.uuid))
      .sort((a, b) => (positions.get(a.uuid) ?? 0) - (positions.get(b.uuid) ?? 0));
  }, [servers.data, serverGroup.serverOrder, pendingServer]);

  const dndServers = useMemo(() => {
    const items = orderedServers
      .map((server) => ({ server, dndId: serverDndId(serverGroup.uuid, server.uuid) }))
      .filter((item) => item.dndId !== hiddenDndId);

    if (!adoptedServer || !adoptedDndId) return items;

    const at = Math.min(Math.max(adoptedIndex ?? items.length, 0), items.length);

    return [...items.slice(0, at), { server: adoptedServer, dndId: adoptedDndId }, ...items.slice(at)];
  }, [orderedServers, serverGroup.uuid, hiddenDndId, adoptedServer, adoptedDndId, adoptedIndex]);

  const serverDndIds = useMemo(() => dndServers.map((item) => item.dndId), [dndServers]);

  const serverCount = servers.total;

  const handleRemoveRequested = useCallback((server: z.infer<typeof serverSchema>) => {
    setServerToRemove({ server });
    setOpenModal('remove-server');
  }, []);

  return (
    <>
      <GroupAddServerModal
        serverGroup={serverGroup}
        opened={openModal === 'add-server'}
        onClose={() => setOpenModal(null)}
        onServerAdded={refetch}
      />
      <ServerGroupEditModal
        serverGroup={serverGroup}
        opened={openModal === 'edit'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.account.home.tabs.groupedServers.page.modal.deleteServerGroup.content', {
          group: serverGroup.name,
        }).md()}
      </ConfirmationModal>
      <ConfirmationModal
        opened={openModal === 'remove-server'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.home.tabs.groupedServers.page.modal.removeServerFromGroup.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemoveServer}
      >
        {t('pages.account.home.tabs.groupedServers.page.modal.removeServerFromGroup.content', {
          server: serverToRemove?.server.name ?? '',
          group: serverGroup.name,
        }).md()}
      </ConfirmationModal>

      <Card
        key={serverGroup.uuid}
        p={0}
        className={classNames(
          'overflow-hidden rounded-xl! transition-shadow duration-150',
          isDropTarget && !dropBlockedReason && 'ring-2 ring-(--mantine-color-blue-filled)',
        )}
      >
        <BlockedOverlay
          visible={isDropTarget && dropBlockedReason === 'alreadyInGroup'}
          icon={faCircleExclamation}
          title={t('pages.account.home.tabs.groupedServers.page.drag.blocked.alreadyInGroup.title', {})}
          description={t('pages.account.home.tabs.groupedServers.page.drag.blocked.alreadyInGroup.description', {
            group: serverGroup.name,
          })}
        />
        <BlockedOverlay
          visible={isDropTarget && dropBlockedReason === 'groupFull'}
          icon={faCircleExclamation}
          title={t('pages.account.home.tabs.groupedServers.page.drag.blocked.groupFull.title', {})}
          description={t('pages.account.home.tabs.groupedServers.page.drag.blocked.groupFull.description', {
            max: MAX_SERVERS_PER_GROUP,
          })}
        />

        <div
          id='server-group-item-header'
          className={classNames(
            'flex flex-row items-end sm:items-center gap-3 px-3 bg-(--mantine-color-dark-7) light:bg-(--mantine-color-gray-0)! justify-between',
            isExpanded && 'border-b border-(--mantine-color-default-border)',
          )}
        >
          <div className='flex flex-col my-3 sm:my-0'>
            <div className='flex flex-row'>
              {dragHandleProps && (
                <ActionIcon
                  size='md'
                  variant='subtle'
                  color='gray'
                  style={{ cursor: 'grab', flexShrink: 0 }}
                  className='text-gray-400! light:text-gray-500!'
                  {...dragHandleProps}
                >
                  <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 16 }} />
                </ActionIcon>
              )}

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className='flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity'
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className={classNames(
                    isExpanded ? 'rotate-90' : 'rotate-0',
                    'transition duration-200 w-3 h-3 text-(--mantine-color-dimmed) shrink-0',
                  )}
                />
                <span className='font-medium flex-1 min-w-0 text-left'>
                  <ScrollingText>{serverGroup.name}</ScrollingText>
                </span>
                <Badge variant={isDark ? 'light' : 'filled'} color='gray'>
                  {tItem('server', serverCount)}
                </Badge>
              </button>
            </div>
            <TextInput
              placeholder={t('common.input.search', {})}
              size='xs'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<FontAwesomeIcon icon={faSearch} />}
              className='w-48 mt-1 sm:hidden'
            />
          </div>

          <div className='flex flex-col sm:flex-row items-center gap-1 mb-1.5 sm:mb-0 py-2.5 flex-1 sm:flex-0 justify-end'>
            <TextInput
              placeholder={t('common.input.search', {})}
              size='xs'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<FontAwesomeIcon icon={faSearch} />}
              className='min-w-32 hidden sm:block'
            />
            <div className='flex flex-row items-center gap-1 w-full justify-end'>
              <Menu shadow='md' width={200} position='bottom-end'>
                <Menu.Target>
                  <Tooltip label={t('pages.account.home.tooltip.groupActions', {})}>
                    <ActionIcon
                      variant='subtle'
                      color='gray'
                      size='sm'
                      disabled={groupActionLoading !== null}
                      loading={groupActionLoading !== null}
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} className='w-3.5 h-3.5' />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('pages.account.home.bulkActions.groupActions', {})}</Menu.Label>
                  <Menu.Item
                    leftSection={<FontAwesomeIcon icon={faPowerOff} />}
                    color='green'
                    onClick={() => handleGroupPowerAction('start')}
                    disabled={groupActionLoading !== null || serverCount === 0}
                  >
                    {t('common.enum.serverPowerAction.start', {})}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FontAwesomeIcon icon={faPowerOff} />}
                    color='gray'
                    onClick={() => handleGroupPowerAction('restart')}
                    disabled={groupActionLoading !== null || serverCount === 0}
                  >
                    {t('common.enum.serverPowerAction.restart', {})}
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FontAwesomeIcon icon={faPowerOff} />}
                    color='red'
                    onClick={() => handleGroupPowerAction('stop')}
                    disabled={groupActionLoading !== null || serverCount === 0}
                  >
                    {t('common.enum.serverPowerAction.stop', {})}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <Tooltip label={t('pages.account.home.tooltip.addServerToGroup', {})}>
                <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => setOpenModal('add-server')}>
                  <FontAwesomeIcon icon={faPlus} className='w-3.5 h-3.5' />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('common.tooltip.edit', {})}>
                <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => setOpenModal('edit')}>
                  <FontAwesomeIcon icon={faPen} className='w-3.5 h-3.5' />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('common.tooltip.delete', {})}>
                <ActionIcon variant='subtle' color='red' size='sm' onClick={() => setOpenModal('delete')}>
                  <FontAwesomeIcon icon={faTrash} className='w-3.5 h-3.5' />
                </ActionIcon>
              </Tooltip>
            </div>
          </div>
        </div>

        <Collapse expanded={isExpanded}>
          <div className='p-3'>
            {loading && servers.data.length === 0 ? (
              <Spinner.Centered />
            ) : dndServers.length === 0 ? (
              <p className='text-gray-500 text-sm text-center py-4 light:text-gray-600!'>
                {t('pages.account.home.noServers', {})}
              </p>
            ) : (
              <DndSortableList id={serverGroup.uuid} items={serverDndIds} strategy={rectSortingStrategy}>
                <div className='gap-3 grid md:grid-cols-2 auto-rows-[minmax(8.5rem,auto)]'>
                  {dndServers.map(({ server, dndId }) => (
                    <SortableItem key={dndId} id={dndId} data={{ server }}>
                      <ServerGroupServerRow
                        server={server}
                        to={getServerTo?.(server)}
                        isSelected={selectedServers?.has(server)}
                        onServerSelectionChange={onServerSelectionChange}
                        onServerClick={onServerClick}
                        sKeyPressedRef={sKeyPressedRef}
                        onRemoveRequested={handleRemoveRequested}
                      />
                    </SortableItem>
                  ))}
                </div>
              </DndSortableList>
            )}

            {servers.total > servers.perPage && (
              <>
                <Divider my='md' />
                <Pagination data={servers} onPageSelect={setPage} />
              </>
            )}
          </div>
        </Collapse>
      </Card>
    </>
  );
}

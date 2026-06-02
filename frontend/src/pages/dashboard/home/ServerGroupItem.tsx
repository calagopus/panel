import { rectSortingStrategy } from '@dnd-kit/sortable';
import {
  faChevronRight,
  faEllipsisVertical,
  faGripVertical,
  faPen,
  faPlus,
  faPowerOff,
  faSearch,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Collapse, Menu, useComputedColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { ComponentProps, memo, startTransition, useEffect, useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import deleteServerGroup from '@/api/me/servers/groups/deleteServerGroup.ts';
import getServerGroupServers from '@/api/me/servers/groups/getServerGroupServers.ts';
import updateServerGroup from '@/api/me/servers/groups/updateServerGroup.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Card from '@/elements/Card.tsx';
import Divider from '@/elements/Divider.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { Pagination } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import ServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import { useBulkPowerActions } from '@/plugins/useBulkPowerActions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import GroupAddServerModal from './modals/GroupAddServerModal.tsx';
import ServerGroupEditModal from './modals/ServerGroupEditModal.tsx';

function insertItems<T>(list: T[], items: T[], startIndex: number): T[] {
  if (startIndex > list.length) {
    throw new Error(`startIndex ${startIndex} is beyond array size ${list.length}`);
  }

  const result = Array.from(list);
  result.splice(startIndex, items.length, ...items);
  return result;
}

interface DndServer extends z.infer<typeof serverSchema>, DndItem {
  id: string;
}

const MemoizedServerItem = memo(ServerItem);

export default function ServerGroupItem({
  serverGroup,
  dragHandleProps,
  selectedServers,
  onServerSelectionChange,
  onServerClick,
  sKeyPressedRef,
}: {
  serverGroup: z.infer<typeof userServerGroupSchema>;
  dragHandleProps: ComponentProps<'button'>;
  selectedServers?: ObjectSet<z.infer<typeof serverSchema>, 'uuid'>;
  onServerSelectionChange?: (server: z.infer<typeof serverSchema>, selected: boolean) => void;
  onServerClick?: (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => void;
  sKeyPressedRef: React.MutableRefObject<boolean>;
}) {
  const { t, tItem } = useTranslations();
  const { updateServerGroup: updateStateServerGroup, removeServerGroup } = useUserStore();
  const { addToast } = useToast();
  const isDark = useComputedColorScheme('dark') === 'dark';

  const [isExpanded, setIsExpanded] = useState(
    localStorage.getItem(`server-group-expanded-${serverGroup.uuid}`) !== 'false',
  );
  const [servers, setServers] = useState(getEmptyPaginationSet<z.infer<typeof serverSchema>>());
  const [openModal, setOpenModal] = useState<'edit' | 'delete' | 'add-server' | null>(null);

  const { handleBulkPowerAction, bulkActionLoading: groupActionLoading } = useBulkPowerActions();

  const { loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: [...queryKeys.user.servers.all(), serverGroup.uuid],
    fetcher: (page, search) => getServerGroupServers(serverGroup.uuid, page, search),
    setStoreData: setServers,
    modifyParams: false,
  });

  useEffect(() => {
    localStorage.setItem(`server-group-expanded-${serverGroup.uuid}`, String(isExpanded));
  }, [isExpanded, serverGroup.uuid]);

  const doDelete = async () => {
    await deleteServerGroup(serverGroup.uuid)
      .then(() => {
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

  const dndServers: DndServer[] = servers.data.map((s) => ({
    ...s,
    id: `${serverGroup.uuid}-${s.uuid}`,
  }));

  const serverCount = servers?.total ?? serverGroup.serverOrder.length;

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

      <Card key={serverGroup.uuid} p={0} className='overflow-hidden rounded-xl!'>
        <div
          id='server-group-item-header'
          className='flex flex-row items-end sm:items-center gap-3 px-3 bg-(--mantine-color-dark-7) light:bg-(--mantine-color-gray-0)! justify-between border-b border-(--mantine-color-default-border)'
        >
          <div className='flex flex-col my-3 sm:my-0'>
            <div className='flex flex-row'>
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
                <span className='font-medium truncate'>{serverGroup.name}</span>
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
            {loading ? (
              <Spinner.Centered />
            ) : servers.total === 0 ? (
              <p className='text-gray-500 text-sm text-center py-4 light:text-gray-600!'>
                {t('pages.account.home.noServers', {})}
              </p>
            ) : (
              <DndContainer
                items={dndServers}
                strategy={rectSortingStrategy}
                callbacks={{
                  onDragEnd: async (items) => {
                    const serverOrder = insertItems(
                      serverGroup.serverOrder,
                      items.map((s) => s.uuid),
                      (servers.page - 1) * servers.perPage,
                    );

                    startTransition(() => {
                      setServers({ ...servers, data: items });
                    });

                    await updateServerGroup(serverGroup.uuid, { serverOrder }).catch((err) => {
                      addToast(httpErrorToHuman(err), 'error');
                      updateStateServerGroup(serverGroup.uuid, {
                        serverOrder: serverGroup.serverOrder,
                      });
                      setServers({ ...servers, data: servers.data });
                    });
                  },
                  onError: (error) => {
                    console.error('Drag error:', error);
                  },
                }}
                renderOverlay={(activeServer) =>
                  activeServer ? (
                    <div style={{ cursor: 'grabbing' }}>
                      <MemoizedServerItem server={activeServer} onGroupRemove={() => null} />
                    </div>
                  ) : null
                }
              >
                {(items) => (
                  <div className='gap-3 grid md:grid-cols-2'>
                    {items.map((server, i) => (
                      <SortableItem key={server.id} id={server.id}>
                        <MemoizedServerItem
                          server={server}
                          showContextMenu
                          isSelected={selectedServers?.has(server)}
                          onSelectionChange={
                            onServerSelectionChange
                              ? (selected) => onServerSelectionChange(server, selected)
                              : undefined
                          }
                          onClick={onServerClick ? (event) => onServerClick(server, event) : undefined}
                          onGroupRemove={() => {
                            const serverOrder = serverGroup.serverOrder.filter(
                              (_, orderI) => (servers.page - 1) * servers.perPage + i !== orderI,
                            );
                            updateStateServerGroup(serverGroup.uuid, {
                              serverOrder,
                            });
                            setServers((prev) => ({ ...prev, data: prev.data.filter((_, dataI) => i !== dataI) }));

                            updateServerGroup(serverGroup.uuid, { serverOrder }).catch((msg) => {
                              addToast(httpErrorToHuman(msg), 'error');
                            });
                          }}
                          sKeyPressedRef={sKeyPressedRef}
                        />
                      </SortableItem>
                    ))}
                  </div>
                )}
              </DndContainer>
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

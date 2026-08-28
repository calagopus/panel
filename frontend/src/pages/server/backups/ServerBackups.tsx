import { faChevronDown, faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ComponentProps, memo, startTransition, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getBackups from '@/api/server/backups/getBackups.ts';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import updateBackupGroupsOrder from '@/api/server/backups/groups/updateBackupGroupsOrder.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupSchema } from '@/lib/schemas/server/backups.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import BackupGroupCard from './BackupGroupCard.tsx';
import BackupGroupItem from './BackupGroupItem.tsx';
import BackupRow from './BackupRow.tsx';
import BackupsSubNavigation from './BackupsSubNavigation.tsx';
import BackupCreateModal from './modals/BackupCreateModal.tsx';
import BackupGroupCreateModal from './modals/BackupGroupCreateModal.tsx';

interface DndBackupGroup extends z.infer<typeof serverBackupGroupSchema>, DndItem {
  id: string;
}

const MemoizedBackupGroupItem = memo(BackupGroupItem);

export default function ServerBackups() {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);
  const backups = useServerStore((state) => state.backups);
  const setBackups = useServerStore((state) => state.setBackups);

  const [openModal, setOpenModal] = useState<'createBackup' | 'createGroup' | null>(null);

  const maxBackupGroupCount = useGlobalStore((state) => state.settings.server.maxBackupGroupCount);

  const canCreateBackup = useServerCan('backups.create');
  const canCreateGroup = useServerCan('backup-groups.create');
  const canReadGroups = useServerCan('backup-groups.read');
  const canUpdateGroups = useServerCan('backup-groups.update');

  const groupsQueryKey = useMemo(() => queryKeys.server(server.uuid).backups.groups.all(), [server.uuid]);

  const { loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).backups.all(),
    fetcher: (page, search) => getBackups(server.uuid, page, search, canReadGroups),
    setStoreData: setBackups,
  });

  const { data: groups } = useQuery({
    queryKey: groupsQueryKey,
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  const sortedGroups = useMemo(() => [...(groups ?? [])].sort((a, b) => a.order - b.order), [groups]);

  const dndGroups: DndBackupGroup[] = useMemo(
    () => sortedGroups.map((group) => ({ ...group, id: group.uuid })),
    [sortedGroups],
  );

  const onGroupsReorder = useCallback(
    async (reordered: DndBackupGroup[]) => {
      const previousGroups = queryClient.getQueryData<z.infer<typeof serverBackupGroupSchema>[]>(groupsQueryKey);

      startTransition(() => {
        queryClient.setQueryData(
          groupsQueryKey,
          reordered.map(({ id: _id, ...group }, index) => ({ ...group, order: index })),
        );
      });

      await updateBackupGroupsOrder(
        server.uuid,
        reordered.map((group) => group.uuid),
      ).catch((error) => {
        addToast(httpErrorToHuman(error), 'error');
        queryClient.setQueryData(groupsQueryKey, previousGroups);
      });
    },
    [addToast, groupsQueryKey, queryClient, server.uuid],
  );

  const groupedBackupCount = (groups ?? []).reduce((sum, group) => sum + group.totalBackups, 0);
  const totalBackupCount = backups.total + groupedBackupCount;
  const atBackupLimit = totalBackupCount >= server.featureLimits.backups;

  const hasGroups = sortedGroups.length > 0;
  const showCreateGroup = canCreateGroup && sortedGroups.length < maxBackupGroupCount;
  const canReorderGroups = canUpdateGroups && sortedGroups.length > 1;

  const ungroupedTable = (
    <Table
      flush={hasGroups}
      columns={[
        t('common.table.columns.name', {}),
        t('common.table.columns.checksum', {}),
        t('common.table.columns.size', {}),
        t('common.table.columns.files', {}),
        t('common.table.columns.created', {}),
        t('pages.server.backups.table.columns.locked', {}),
        '',
      ]}
      loading={loading}
      pagination={backups}
      onPageSelect={setPage}
      error={error}
    >
      {backups.data.map((backup) => (
        <BackupRow backup={backup} key={backup.uuid} />
      ))}
    </Table>
  );

  return (
    <ServerContentContainer
      title={t('pages.server.backups.title', {})}
      subtitle={t('pages.server.backups.subtitle', {
        current: totalBackupCount,
        max: server.featureLimits.backups,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        canCreateBackup && !showCreateGroup ? (
          <ConditionalTooltip
            enabled={atBackupLimit}
            label={t('pages.server.backups.tooltip.limitReached', {
              max: server.featureLimits.backups,
            })}
          >
            <Button
              disabled={atBackupLimit}
              onClick={() => setOpenModal('createBackup')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        ) : (
          (canCreateBackup || showCreateGroup) && (
            <ContextMenu
              items={[
                {
                  type: 'action',
                  icon: faPlus,
                  label: t('pages.server.backups.button.createBackup', {}),
                  onClick: () => setOpenModal('createBackup'),
                  disabled: atBackupLimit,
                  color: 'gray',
                  canAccess: canCreateBackup,
                },
                {
                  type: 'action',
                  icon: faLayerGroup,
                  label: t('pages.server.backups.button.createGroup', {}),
                  onClick: () => setOpenModal('createGroup'),
                  color: 'gray',
                  canAccess: showCreateGroup,
                },
              ]}
            >
              {({ openMenu }) => (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    openMenu(rect.left, rect.bottom);
                  }}
                  color='blue'
                  rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                >
                  {t('common.button.create', {})}
                </Button>
              )}
            </ContextMenu>
          )
        )
      }
      registry={window.extensionContext.extensionRegistry.pages.server.backups.container}
    >
      <BackupCreateModal opened={openModal === 'createBackup'} onClose={() => setOpenModal(null)} />
      <BackupGroupCreateModal opened={openModal === 'createGroup'} onClose={() => setOpenModal(null)} />

      <BackupsSubNavigation />

      <Stack>
        {canReorderGroups ? (
          <DndContainer
            items={dndGroups}
            callbacks={{ onDragEnd: onGroupsReorder }}
            getItemLabel={(group) => group.name}
            renderOverlay={(activeGroup) =>
              activeGroup ? (
                <div style={{ cursor: 'grabbing' }} className='shadow-xl rounded-xl'>
                  <MemoizedBackupGroupItem group={activeGroup} dragHandleProps={{ style: { cursor: 'grabbing' } }} />
                </div>
              ) : null
            }
          >
            {(items) =>
              items.map((group) => (
                <SortableItem
                  key={group.uuid}
                  id={group.uuid}
                  renderItem={({ dragHandleProps }) => (
                    <MemoizedBackupGroupItem
                      group={group}
                      dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                    />
                  )}
                />
              ))
            }
          </DndContainer>
        ) : (
          sortedGroups.map((group) => <BackupGroupItem key={group.uuid} group={group} />)
        )}

        {hasGroups ? (
          <BackupGroupCard
            storageKey={`${server.uuid}-ungrouped`}
            header={
              <>
                <span className='font-medium truncate'>{t('pages.server.backupGroups.ungrouped', {})}</span>
                <Badge variant='light' color='gray'>
                  {tItem('backup', backups.total)}
                </Badge>
              </>
            }
          >
            {ungroupedTable}
          </BackupGroupCard>
        ) : (
          ungroupedTable
        )}
      </Stack>
    </ServerContentContainer>
  );
}

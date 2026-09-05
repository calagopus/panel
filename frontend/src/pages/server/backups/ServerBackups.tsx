import { faChevronDown, faLayerGroup, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ComponentProps, memo, ReactNode, startTransition, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getBackups from '@/api/server/backups/getBackups.ts';
import getBackupUsage from '@/api/server/backups/getBackupUsage.ts';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import updateBackupGroupsOrder from '@/api/server/backups/groups/updateBackupGroupsOrder.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/dnd/DragAndDrop.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupFilterSchema, serverBackupGroupSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import BackupGroupCard from './BackupGroupCard.tsx';
import BackupGroupItem from './BackupGroupItem.tsx';
import BackupRow from './BackupRow.tsx';
import BackupsSubNavigation from './BackupsSubNavigation.tsx';
import { getBackupColumns } from './columns.ts';
import BackupCreateModal from './modals/BackupCreateModal.tsx';
import BackupGroupCreateModal from './modals/BackupGroupCreateModal.tsx';

interface DndBackupGroup extends z.infer<typeof serverBackupGroupSchema>, DndItem {
  id: string;
}

const MemoizedBackupGroupItem = memo(BackupGroupItem);

const EMPTY_BACKUPS = getEmptyPaginationSet<z.infer<typeof serverBackupSchema>>();

export interface ServerBackupsProps {
  variant?: 'page' | 'section';
  /** Only one store-backed list may be mounted at a time. */
  dataSource?: 'store' | 'local';
  filter?: z.infer<typeof serverBackupFilterSchema>;
  showKind?: boolean;
  showSource?: boolean;
  showFiles?: boolean;
  createDefaults?: { databaseInstanceUuid: string | null };
  createBlockedReason?: string | null;
  headerActions?: ReactNode;
  modifyParams?: boolean;
}

export default function ServerBackups({
  variant = 'page',
  dataSource = 'store',
  filter,
  showKind = true,
  showSource = showKind,
  showFiles = true,
  createDefaults,
  createBlockedReason = null,
  headerActions,
  modifyParams,
}: ServerBackupsProps) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);
  const storeBackups = useServerStore((state) => (dataSource === 'store' ? state.backups : EMPTY_BACKUPS));
  const setStoreBackups = useServerStore((state) => state.setBackups);
  const [localBackups, setLocalBackups] = useState(EMPTY_BACKUPS);

  const [openModal, setOpenModal] = useState<'createBackup' | 'createGroup' | null>(null);

  const maxBackupGroupCount = useGlobalStore((state) => state.settings.server.maxBackupGroupCount);

  const canCreateBackup = useServerCan('backups.create');
  const canCreateGroup = useServerCan('backup-groups.create');
  const canReadGroups = useServerCan('backup-groups.read');
  const canUpdateGroups = useServerCan('backup-groups.update');

  const storeBacked = dataSource === 'store';
  const backups = storeBacked ? storeBackups : localBackups;
  const setBackups = storeBacked ? setStoreBackups : setLocalBackups;
  const showGroups = variant === 'page';
  const showGroupLabels = variant === 'section';
  const columns = useMemo(
    () => getBackupColumns({ kind: showKind, source: showSource, files: showFiles, locked: true }),
    [showKind, showSource, showFiles],
  );

  const groupsQueryKey = useMemo(() => queryKeys.server(server.uuid).backups.groups.all(), [server.uuid]);

  const { loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).backups.all(),
    fetcher: (page, search) => getBackups(server.uuid, page, search, showGroups && canReadGroups, filter),
    deps: [filter],
    setStoreData: setBackups,
    modifyParams: modifyParams ?? variant === 'page',
  });

  const { data: groups } = useQuery({
    queryKey: groupsQueryKey,
    queryFn: () => getBackupGroups(server.uuid),
    enabled: (showGroups || showGroupLabels) && canReadGroups,
  });

  const { data: usage } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.usage(),
    queryFn: () => getBackupUsage(server.uuid),
  });

  const sortedGroups = useMemo(() => [...(groups ?? [])].sort((a, b) => a.order - b.order), [groups]);
  const groupNames = useMemo(() => new Map((groups ?? []).map((group) => [group.uuid, group.name])), [groups]);

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
  const totalBackupCount = usage ? usage.server + usage.databaseInstance : backups.total + groupedBackupCount;
  const atBackupLimit = totalBackupCount >= server.featureLimits.backups;
  // the section list is filtered to one kind, so its fallback understates the shared limit
  const usageUnknown = !usage && variant === 'section';
  const createDisabled = atBackupLimit || usageUnknown || createBlockedReason !== null;
  const createTooltip = atBackupLimit
    ? t(
        variant === 'page'
          ? 'pages.server.backups.tooltip.limitReached'
          : 'pages.server.databases.instance.backups.tooltip.limitReached',
        { max: server.featureLimits.backups },
      )
    : (createBlockedReason ?? '');

  const hasGroups = showGroups && sortedGroups.length > 0;
  const showCreateGroup = showGroups && canCreateGroup && sortedGroups.length < maxBackupGroupCount;
  const canReorderGroups = canUpdateGroups && sortedGroups.length > 1;

  const subtitle =
    variant === 'page'
      ? usage && usage.databaseInstance > 0
        ? t('pages.server.backups.subtitleWithDatabase', {
            current: totalBackupCount,
            max: server.featureLimits.backups,
            server: usage.server,
            database: usage.databaseInstance,
          })
        : t('pages.server.backups.subtitle', {
            current: totalBackupCount,
            max: server.featureLimits.backups,
          })
      : t('pages.server.databases.instance.backups.subtitle', {
          current: totalBackupCount,
          max: server.featureLimits.backups,
        });

  const createControl =
    canCreateBackup && !showCreateGroup ? (
      <ConditionalTooltip enabled={createDisabled && !!createTooltip} label={createTooltip}>
        <Button
          disabled={createDisabled}
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
              disabled: createDisabled,
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
    );

  const ungroupedTable = (
    <Table
      flush={hasGroups}
      columns={columns.headers}
      loading={loading}
      pagination={backups}
      onPageSelect={setPage}
      error={error}
    >
      {backups.data.map((backup) => (
        <BackupRow
          backup={backup}
          backupGroupName={
            canReadGroups && showGroupLabels && backup.backupGroupUuid
              ? groupNames.get(backup.backupGroupUuid)
              : undefined
          }
          columns={columns}
          key={backup.uuid}
        />
      ))}
    </Table>
  );

  const body = (
    <>
      <BackupCreateModal
        createDefaults={createDefaults}
        opened={openModal === 'createBackup'}
        onClose={() => setOpenModal(null)}
      />
      {showGroups && <BackupGroupCreateModal opened={openModal === 'createGroup'} onClose={() => setOpenModal(null)} />}

      {showGroups ? (
        <Stack>
          {canReorderGroups ? (
            <DndContainer
              items={dndGroups}
              callbacks={{ onDragEnd: onGroupsReorder }}
              getItemLabel={(group) => group.name}
              renderOverlay={(activeGroup) =>
                activeGroup ? (
                  <div style={{ cursor: 'grabbing' }} className='shadow-xl rounded-xl'>
                    <MemoizedBackupGroupItem
                      group={activeGroup}
                      columns={columns}
                      dragHandleProps={{ style: { cursor: 'grabbing' } }}
                    />
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
                        columns={columns}
                        dragHandleProps={dragHandleProps as unknown as ComponentProps<'button'>}
                      />
                    )}
                  />
                ))
              }
            </DndContainer>
          ) : (
            sortedGroups.map((group) => <BackupGroupItem key={group.uuid} group={group} columns={columns} />)
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
      ) : (
        ungroupedTable
      )}
    </>
  );

  if (variant === 'section') {
    return (
      <Stack>
        <Group justify='space-between'>
          <div>
            <Title order={2}>{t('pages.server.databases.instance.backups.title', {})}</Title>
            {usage && (
              <Text size='xs' c='dimmed'>
                {subtitle}
              </Text>
            )}
          </div>
          <Group>
            {headerActions}
            <TextInput
              placeholder={t('common.input.search', {})}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<FontAwesomeIcon icon={faSearch} />}
              w={250}
            />
            {createControl}
          </Group>
        </Group>

        {body}
      </Stack>
    );
  }

  return (
    <ServerContentContainer
      title={t('pages.server.backups.title', {})}
      subtitle={subtitle}
      search={search}
      setSearch={setSearch}
      contentRight={createControl}
      registry={window.extensionContext.extensionRegistry.pages.server.backups.container}
    >
      <BackupsSubNavigation />

      {body}
    </ServerContentContainer>
  );
}

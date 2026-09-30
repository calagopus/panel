import { faPen, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, Ref, useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getBackupGroupBackups from '@/api/server/backups/groups/getBackupGroupBackups.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import BackupRetentionBadge from '@/elements/data-display/BackupRetentionBadge.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Table, { Pagination, tableSelectionHeader } from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ScrollingText from '@/elements/ScrollingText.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import BackupActionBar from '@/pages/server/backups/BackupActionBar.tsx';
import BackupRow from '@/pages/server/backups/BackupRow.tsx';
import BackupCreateModal from '@/pages/server/backups/modals/BackupCreateModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupGroupCard from './BackupGroupCard.tsx';
import { BackupColumns } from './columns.ts';
import BackupGroupDeleteModal from './modals/BackupGroupDeleteModal.tsx';
import BackupGroupEditModal from './modals/BackupGroupEditModal.tsx';
import { useBackupSelection } from './useBackupSelection.ts';

export default function BackupGroupItem({
  group,
  groups,
  columns,
  activeScope,
  setActiveScope,
  dragHandleProps,
}: {
  group: z.infer<typeof serverBackupGroupSchema>;
  /** Left out for the drag preview, which renders a copy of the card with no selection. */
  groups?: z.infer<typeof serverBackupGroupSchema>[];
  columns: BackupColumns;
  activeScope?: string | null;
  setActiveScope?: (scope: string | null) => void;
  dragHandleProps?: ComponentProps<'button'>;
}) {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canUpdate = useServerCan('backup-groups.update');
  const canDelete = useServerCan('backup-groups.delete');
  const canCreateBackup = useServerCan('backups.create');

  const [backups, setBackups] = useState(getEmptyPaginationSet<z.infer<typeof serverBackupSchema>>());
  const [openModal, setOpenModal] = useState<'createBackup' | 'edit' | 'delete' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: [...queryKeys.server(server.uuid).backups.groups.detail(group.uuid)],
    fetcher: (page, search) => getBackupGroupBackups(server.uuid, group.uuid, page, search),
    setStoreData: setBackups,
    modifyParams: false,
  });

  const canSelect =
    useServerCan(['backups.update', 'backups.delete']) && groups !== undefined && setActiveScope !== undefined;

  const {
    selected: selectedBackups,
    toggle: toggleBackup,
    clear: clearSelection,
    selectAll,
    allSelected,
    scopeProps,
    selectionAreaProps,
  } = useBackupSelection({
    scope: group.uuid,
    activeScope,
    setActiveScope,
    items: backups.data,
    enabled: canSelect,
  });

  const allLocked = group.usableBackups > 0 && group.usableUnlockedBackups === 0;

  return (
    <>
      <BackupCreateModal
        groupUuid={group.uuid}
        opened={openModal === 'createBackup'}
        onClose={() => setOpenModal(null)}
      />
      <BackupGroupEditModal group={group} opened={openModal === 'edit'} onClose={() => setOpenModal(null)} />
      <BackupGroupDeleteModal group={group} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />

      <BackupGroupCard
        {...scopeProps}
        storageKey={group.uuid}
        dragHandleProps={dragHandleProps}
        header={
          <>
            <span className='font-medium min-w-0 text-left'>
              <ScrollingText>{group.name}</ScrollingText>
            </span>
            <Badge variant='light' color='gray'>
              {tItem('backup', group.totalBackups)}
            </Badge>
            <BackupRetentionBadge retention={group.retention} />
            {allLocked && (
              <Badge variant='light' color='red'>
                {t('pages.server.backupGroups.badge.allLocked', {})}
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <TextInput
              placeholder={t('common.input.search', {})}
              size='xs'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftSection={<FontAwesomeIcon icon={faSearch} />}
              className='min-w-32'
            />
            <div className='flex flex-row items-center gap-1'>
              {canUpdate && (
                <Tooltip label={t('common.tooltip.edit', {})}>
                  <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => setOpenModal('edit')}>
                    <FontAwesomeIcon icon={faPen} className='w-3.5 h-3.5' />
                  </ActionIcon>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip label={t('common.tooltip.delete', {})}>
                  <ActionIcon variant='subtle' color='red' size='sm' onClick={() => setOpenModal('delete')}>
                    <FontAwesomeIcon icon={faTrash} className='w-3.5 h-3.5' />
                  </ActionIcon>
                </Tooltip>
              )}
            </div>
          </>
        }
      >
        {loading ? (
          <div className='py-4'>
            <Spinner.Centered />
          </div>
        ) : backups.total === 0 ? (
          <div className='flex flex-row items-center justify-between gap-2 px-3 py-1.5'>
            <span className='text-sm text-(--mantine-color-dimmed)'>
              {t('pages.server.backupGroups.noBackups', {})}
            </span>
            {canCreateBackup && (
              <Button variant='light' color='gray' size='compact-xs' onClick={() => setOpenModal('createBackup')}>
                {t('pages.server.backupGroups.button.createInGroup', {})}
              </Button>
            )}
          </div>
        ) : (
          <SelectionArea {...selectionAreaProps} disabled={!canSelect}>
            <Table
              flush
              columns={
                canSelect
                  ? [
                      tableSelectionHeader({
                        checked: allSelected,
                        indeterminate: selectedBackups.size > 0 && !allSelected,
                        onChange: (checked) => (checked ? selectAll() : clearSelection()),
                      }),
                      ...columns.headers,
                    ]
                  : columns.headers
              }
              pagination={backups}
            >
              {backups.data.map((backup) => (
                <SelectionArea.Selectable key={backup.uuid} item={backup}>
                  {(innerRef: Ref<HTMLElement>) => (
                    <BackupRow
                      backup={backup}
                      columns={columns}
                      ref={innerRef as Ref<HTMLTableRowElement>}
                      isSelected={selectedBackups.has(backup.uuid)}
                      onSelectionChange={canSelect ? (selected) => toggleBackup(backup, selected) : undefined}
                    />
                  )}
                </SelectionArea.Selectable>
              ))}
            </Table>
          </SelectionArea>
        )}

        {backups.total > backups.perPage && (
          <div className='px-3 py-2 border-t border-(--mantine-color-default-border)'>
            <Pagination data={backups} onPageSelect={setPage} />
          </div>
        )}
      </BackupGroupCard>

      {canSelect && groups && (
        <BackupActionBar selectedBackups={selectedBackups} groups={groups} clearSelection={clearSelection} />
      )}
    </>
  );
}

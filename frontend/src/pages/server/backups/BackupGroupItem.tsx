import { faPen, faSearch, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getBackupGroupBackups from '@/api/server/backups/groups/getBackupGroupBackups.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { Pagination } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import BackupRow from '@/pages/server/backups/BackupRow.tsx';
import BackupCreateModal from '@/pages/server/backups/modals/BackupCreateModal.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupGroupCard from './BackupGroupCard.tsx';
import BackupGroupDeleteModal from './modals/BackupGroupDeleteModal.tsx';
import BackupGroupEditModal from './modals/BackupGroupEditModal.tsx';

export default function BackupGroupItem({ group }: { group: z.infer<typeof serverBackupGroupSchema> }) {
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

  const overRetention = group.retentionCount !== null && group.usableBackups > group.retentionCount;
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
        storageKey={group.uuid}
        header={
          <>
            <span className='font-medium truncate'>{group.name}</span>
            {group.retentionCount !== null ? (
              <Tooltip
                label={t('pages.server.backupGroups.badge.keepCount', {
                  count: group.retentionCount,
                })}
              >
                <Badge variant='light' color={overRetention ? 'yellow' : 'gray'}>
                  {group.usableBackups}/{group.retentionCount}
                </Badge>
              </Tooltip>
            ) : (
              <Badge variant='light' color='gray'>
                {tItem('backup', group.totalBackups)}
              </Badge>
            )}
            {group.retentionDays !== null && (
              <Badge variant='light' color='blue'>
                {t('pages.server.backupGroups.badge.keepDays', {
                  days: tItem('day', group.retentionDays),
                })}
              </Badge>
            )}
            {group.retentionCount === null && group.retentionDays === null && (
              <Badge variant='light' color='gray'>
                {t('pages.server.backupGroups.badge.noRetention', {})}
              </Badge>
            )}
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
          <Table
            flush
            columns={[
              t('common.table.columns.name', {}),
              t('pages.server.backups.table.columns.checksum', {}),
              t('common.table.columns.size', {}),
              t('pages.server.backups.table.columns.files', {}),
              t('common.table.columns.created', {}),
              t('pages.server.backups.table.columns.locked', {}),
              '',
            ]}
          >
            {backups.data.map((backup) => (
              <BackupRow backup={backup} key={backup.uuid} />
            ))}
          </Table>
        )}

        {backups.total > backups.perPage && (
          <div className='px-3 py-2 border-t border-(--mantine-color-default-border)'>
            <Pagination data={backups} onPageSelect={setPage} />
          </div>
        )}
      </BackupGroupCard>
    </>
  );
}

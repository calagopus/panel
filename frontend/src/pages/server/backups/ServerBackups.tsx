import { faChevronDown, faLayerGroup, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import getBackups from '@/api/server/backups/getBackups.ts';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import BackupGroupCard from './BackupGroupCard.tsx';
import BackupGroupItem from './BackupGroupItem.tsx';
import BackupRow from './BackupRow.tsx';
import BackupCreateModal from './modals/BackupCreateModal.tsx';
import BackupGroupCreateModal from './modals/BackupGroupCreateModal.tsx';

export default function ServerBackups() {
  const { t, tItem } = useTranslations();
  const server = useServerStore((state) => state.server);
  const backups = useServerStore((state) => state.backups);
  const setBackups = useServerStore((state) => state.setBackups);

  const [openModal, setOpenModal] = useState<'createBackup' | 'createGroup' | null>(null);

  const maxBackupGroupCount = useGlobalStore((state) => state.settings.server.maxBackupGroupCount);

  const canCreateBackup = useServerCan('backups.create');
  const canCreateGroup = useServerCan('backup-groups.create');
  const canReadGroups = useServerCan('backup-groups.read');

  const { loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).backups.all(),
    fetcher: (page, search) => getBackups(server.uuid, page, search, canReadGroups),
    setStoreData: setBackups,
  });

  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  const groupedBackupCount = (groups ?? []).reduce((sum, group) => sum + group.totalBackups, 0);
  const totalBackupCount = backups.total + groupedBackupCount;
  const atBackupLimit = totalBackupCount >= server.featureLimits.backups;

  const hasGroups = (groups?.length ?? 0) > 0;
  const showCreateGroup = canCreateGroup && (groups?.length ?? 0) < maxBackupGroupCount;

  const ungroupedTable = (
    <Table
      flush={hasGroups}
      columns={[
        t('common.table.columns.name', {}),
        t('pages.server.backups.table.columns.checksum', {}),
        t('common.table.columns.size', {}),
        t('pages.server.backups.table.columns.files', {}),
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

      <Stack>
        {(groups ?? []).map((group) => (
          <BackupGroupItem key={group.uuid} group={group} />
        ))}

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

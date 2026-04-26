import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getBackups from '@/api/server/backups/getBackups.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupRow from './BackupRow.tsx';
import BackupCreateModal from './modals/BackupCreateModal.tsx';

export default function ServerBackups() {
  const { t } = useTranslations();
  const { server } = useServerStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).backups.all(),
    fetcher: (page, search) => getBackups(server.uuid, page, search),
  });

  const backups = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <ServerContentContainer
      title={t('pages.server.backups.title', {})}
      subtitle={t('pages.server.backups.subtitle', {
        current: backups.total,
        max: server.featureLimits.backups,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ServerCan action='backups.create'>
          <ConditionalTooltip
            enabled={backups.total >= server.featureLimits.backups}
            label={t('pages.server.backups.tooltip.limitReached', { max: server.featureLimits.backups })}
          >
            <Button
              disabled={backups.total >= server.featureLimits.backups}
              onClick={() => setOpenModal('create')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.backups.container}
    >
      <BackupCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
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
        >
          {backups.data.map((backup) => (
            <BackupRow backup={backup} key={backup.uuid} />
          ))}
        </Table>
      </ContextMenuProvider>
    </ServerContentContainer>
  );
}

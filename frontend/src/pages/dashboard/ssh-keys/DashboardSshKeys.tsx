import { faDownload, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useState } from 'react';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getSshKeys from '@/api/me/ssh-keys/getSshKeys.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SshKeyCreateModal from './modals/SshKeyCreateModal.tsx';
import SshKeyImportModal from './modals/SshKeyImportModal.tsx';
import SshKeyRow from './SshKeyRow.tsx';

export default function DashboardSshKeys() {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'create' | 'import' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sshKeys.all(),
    fetcher: getSshKeys,
  });

  const sshKeys = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AccountContentContainer
      title={t('pages.account.sshKeys.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <Button
            onClick={() => setOpenModal('import')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faDownload} />}
          >
            {t('pages.account.sshKeys.button.import', {})}
          </Button>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.create', {})}
          </Button>
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.sshKeys.container}
    >
      <SshKeyCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      <SshKeyImportModal opened={openModal === 'import'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('pages.account.sshKeys.table.columns.fingerprint', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={sshKeys}
          onPageSelect={setPage}
        >
          {sshKeys.data.map((key) => (
            <SshKeyRow key={key.uuid} sshKey={key} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

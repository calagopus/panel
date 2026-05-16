import { faDownload, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useState } from 'react';
import getSshKeys from '@/api/me/ssh-keys/getSshKeys.ts';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useUserStore } from '@/stores/user.ts';
import SshKeyCreateModal from './modals/SshKeyCreateModal.tsx';
import SshKeyImportModal from './modals/SshKeyImportModal.tsx';
import SshKeyRow from './SshKeyRow.tsx';

export default function DashboardSshKeys() {
  const { t } = useTranslations();
  const { sshKeys, setSshKeys } = useUserStore();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | 'import' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sshKeys.all(),
    fetcher: getSshKeys,
    setStoreData: setSshKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.sshKeys.title', {})}
      subtitle={t('pages.account.sshKeys.subtitle', { current: sshKeys.total, max: settings.user.maxSshKeyCount })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <ConditionalTooltip
            enabled={sshKeys.total >= settings.user.maxSshKeyCount}
            label={t('pages.account.sshKeys.tooltip.limitReached', { max: settings.user.maxSshKeyCount })}
          >
            <Button
              onClick={() => setOpenModal('import')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faDownload} />}
              disabled={sshKeys.total >= settings.user.maxSshKeyCount}
            >
              {t('pages.account.sshKeys.button.import', {})}
            </Button>
          </ConditionalTooltip>
          <ConditionalTooltip
            enabled={sshKeys.total >= settings.user.maxSshKeyCount}
            label={t('pages.account.sshKeys.tooltip.limitReached', { max: settings.user.maxSshKeyCount })}
          >
            <Button
              onClick={() => setOpenModal('create')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              disabled={sshKeys.total >= settings.user.maxSshKeyCount}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
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

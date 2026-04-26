import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getSecurityKeys from '@/api/me/security-keys/getSecurityKeys.ts';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SecurityKeyCreateModal from './modals/SecurityKeyCreateModal.tsx';
import SshKeyRow from './SecurityKeyRow.tsx';

export default function DashboardSecurityKeys() {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.securityKeys.all(),
    fetcher: getSecurityKeys,
  });

  const securityKeys = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AccountContentContainer
      title={t('pages.account.securityKeys.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip
          label={t('pages.account.securityKeys.tooltip.secureContextRequired', {})}
          enabled={!window.navigator.credentials}
        >
          <Button
            onClick={() => setOpenModal('create')}
            disabled={!window.navigator.credentials}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </ConditionalTooltip>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.securityKeys.container}
    >
      <SecurityKeyCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('pages.account.securityKeys.table.columns.credentialId', {}),
            t('common.table.columns.lastUsed', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={securityKeys}
          onPageSelect={setPage}
        >
          {securityKeys.data.map((key) => (
            <SshKeyRow key={key.uuid} securityKey={key} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

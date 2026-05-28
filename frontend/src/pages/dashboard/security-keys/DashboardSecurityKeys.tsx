import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getSecurityKeys from '@/api/me/security-keys/getSecurityKeys.ts';
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
import SecurityKeyCreateModal from './modals/SecurityKeyCreateModal.tsx';
import SecurityKeyRow from './SecurityKeyRow.tsx';

export default function DashboardSecurityKeys() {
  const { t } = useTranslations();
  const { securityKeys, setSecurityKeys } = useUserStore();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.securityKeys.all(),
    fetcher: getSecurityKeys,
    setStoreData: setSecurityKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.securityKeys.title', {})}
      subtitle={t('pages.account.securityKeys.subtitle', {
        current: securityKeys.total,
        max: settings.user.maxSecurityKeyCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip
          label={
            securityKeys.total >= settings.user.maxSecurityKeyCount
              ? t('pages.account.securityKeys.tooltip.limitReached', { max: settings.user.maxSecurityKeyCount })
              : t('pages.account.securityKeys.tooltip.secureContextRequired', {})
          }
          enabled={!window.navigator.credentials || securityKeys.total >= settings.user.maxSecurityKeyCount}
        >
          <Button
            onClick={() => setOpenModal('create')}
            disabled={!window.navigator.credentials || securityKeys.total >= settings.user.maxSecurityKeyCount}
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
            <SecurityKeyRow key={key.uuid} securityKey={key} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

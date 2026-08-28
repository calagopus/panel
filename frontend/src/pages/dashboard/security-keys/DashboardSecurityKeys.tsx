import { faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getSecurityKeys from '@/api/me/security-keys/getSecurityKeys.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import SecurityKeyCreateModal from './modals/SecurityKeyCreateModal.tsx';
import SecurityKeyRow from './SecurityKeyRow.tsx';

export default function DashboardSecurityKeys() {
  const { t } = useTranslations();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: securityKeys,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.securityKeys.all(),
    fetcher: getSecurityKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.securityKeys.title', {})}
      subtitle={t('pages.account.securityKeys.subtitle', {
        current: securityKeys?.total ?? 0,
        max: settings.user.maxSecurityKeyCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip
          label={
            settings.webauthn?.enabled === false
              ? t('pages.account.securityKeys.tooltip.disabled', {})
              : (securityKeys?.total ?? 0) >= settings.user.maxSecurityKeyCount
                ? t('pages.account.securityKeys.tooltip.limitReached', { max: settings.user.maxSecurityKeyCount })
                : t('pages.account.securityKeys.tooltip.secureContextRequired', {})
          }
          enabled={
            settings.webauthn?.enabled === false ||
            !window.navigator.credentials ||
            (securityKeys?.total ?? 0) >= settings.user.maxSecurityKeyCount
          }
        >
          <Button
            onClick={() => setOpenModal('create')}
            disabled={
              settings.webauthn?.enabled === false ||
              !window.navigator.credentials ||
              (securityKeys?.total ?? 0) >= settings.user.maxSecurityKeyCount
            }
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

      {settings.webauthn?.enabled === false && (
        <Alert
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          color='yellow'
          title={t('common.alert.warning', {})}
          className='mb-4'
        >
          {t('pages.account.securityKeys.alert.disabled', {})}
        </Alert>
      )}

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
        error={error}
      >
        {securityKeys?.data.map((key) => (
          <SecurityKeyRow key={key.uuid} securityKey={key} total={securityKeys.total} />
        ))}
      </Table>
    </AccountContentContainer>
  );
}

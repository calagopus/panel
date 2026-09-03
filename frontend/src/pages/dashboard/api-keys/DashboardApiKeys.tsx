import { faCode, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getApiKeys from '@/api/me/api-keys/getApiKeys.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import ApiKeyTokenModal from '@/pages/dashboard/api-keys/modals/ApiKeyTokenModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import ApiKeyRow from './ApiKeyRow.tsx';

export default function DashboardApiKeys() {
  const { t } = useTranslations();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const {
    data: apiKeys,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.apiKeys.all(),
    fetcher: getApiKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.apiKeys.title', {})}
      subtitle={t('pages.account.apiKeys.subtitle', {
        current: apiKeys?.total ?? 0,
        max: settings.user.maxApiKeyCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <Anchor href='/api' target='_blank'>
            <Button variant='light' color='gray' leftSection={<FontAwesomeIcon icon={faCode} />}>
              {t('pages.account.apiKeys.button.apiDocumentation', {})}
            </Button>
          </Anchor>
          <ConditionalTooltip
            enabled={(apiKeys?.total ?? 0) >= settings.user.maxApiKeyCount}
            label={t('pages.account.apiKeys.tooltip.limitReached', { max: settings.user.maxApiKeyCount })}
          >
            <Button
              onClick={() => setOpenModal('create')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              disabled={(apiKeys?.total ?? 0) >= settings.user.maxApiKeyCount}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.container}
    >
      <ApiKeyCreateOrUpdateModal
        opened={openModal === 'create'}
        onClose={() => setOpenModal(null)}
        onCreated={setCreatedToken}
      />
      <ApiKeyTokenModal token={createdToken} onClose={() => setCreatedToken(null)} />

      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('pages.account.apiKeys.table.columns.key', {}),
          t('pages.account.apiKeys.table.columns.permissions', {}),
          t('common.table.columns.status', {}),
          t('common.table.columns.lastUsed', {}),
          t('pages.account.apiKeys.table.columns.expires', {}),
          t('common.table.columns.created', {}),
          '',
        ]}
        loading={loading}
        pagination={apiKeys}
        onPageSelect={setPage}
        error={error}
      >
        {apiKeys?.data.map((key) => (
          <ApiKeyRow key={key.uuid} apiKey={key} />
        ))}
      </Table>
    </AccountContentContainer>
  );
}

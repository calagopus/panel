import { faCode, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useState } from 'react';
import getApiKeys from '@/api/me/api-keys/getApiKeys.ts';
import Anchor from '@/elements/Anchor.tsx';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useUserStore } from '@/stores/user.ts';
import ApiKeyRow from './ApiKeyRow.tsx';

export default function DashboardApiKeys() {
  const { t } = useTranslations();
  const { apiKeys, setApiKeys } = useUserStore();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.apiKeys.all(),
    fetcher: getApiKeys,
    setStoreData: setApiKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.apiKeys.title', {})}
      subtitle={t('pages.account.apiKeys.subtitle', { current: apiKeys.total, max: settings.user.maxApiKeyCount })}
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
            enabled={apiKeys.total >= settings.user.maxApiKeyCount}
            label={t('pages.account.apiKeys.tooltip.limitReached', { max: settings.user.maxApiKeyCount })}
          >
            <Button
              onClick={() => setOpenModal('create')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              disabled={apiKeys.total >= settings.user.maxApiKeyCount}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.apiKeys.container}
    >
      <ApiKeyCreateOrUpdateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('pages.account.apiKeys.table.columns.key', {}),
            t('pages.account.apiKeys.table.columns.permissions', {}),
            t('common.table.columns.lastUsed', {}),
            t('pages.account.apiKeys.table.columns.expires', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={apiKeys}
          onPageSelect={setPage}
        >
          {apiKeys.data.map((key) => (
            <ApiKeyRow key={key.uuid} apiKey={key} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

import { faCode, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useState } from 'react';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getApiKeys from '@/api/me/api-keys/getApiKeys.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import ApiKeyCreateOrUpdateModal from '@/pages/dashboard/api-keys/modals/ApiKeyCreateOrUpdateModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ApiKeyRow from './ApiKeyRow.tsx';

export default function DashboardApiKeys() {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.apiKeys.all(),
    fetcher: getApiKeys,
  });

  const apiKeys = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AccountContentContainer
      title={t('pages.account.apiKeys.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <a href='/api' target='_blank'>
            <Button variant='light' color='gray' leftSection={<FontAwesomeIcon icon={faCode} />}>
              {t('pages.account.apiKeys.button.apiDocumentation', {})}
            </Button>
          </a>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.create', {})}
          </Button>
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

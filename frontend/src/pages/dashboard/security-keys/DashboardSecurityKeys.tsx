import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title } from '@mantine/core';
import { useState } from 'react';
import getSecurityKeys from '@/api/me/security-keys/getSecurityKeys.ts';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Table from '@/elements/Table.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import SecurityKeyCreateModal from './modals/SecurityKeyCreateModal.tsx';
import SshKeyRow from './SecurityKeyRow.tsx';

export default function DashboardSecurityKeys() {
  const { t } = useTranslations();
  const { securityKeys, setSecurityKeys } = useUserStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    fetcher: getSecurityKeys,
    setStoreData: setSecurityKeys,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.securityKeys.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.securityKeys.container}
    >
      <SecurityKeyCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <Group justify='space-between' align='start' mb='md'>
        <Title order={1} c='white'>
          {t('pages.account.securityKeys.title', {})}
        </Title>
        <Group>
          <TextInput
            placeholder={t('common.input.search', {})}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            w={250}
          />
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
        </Group>
      </Group>

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

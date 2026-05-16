import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getCommandSnippets from '@/api/me/command-snippets/getCommandSnippets.ts';
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
import CommandSnippetRow from './CommandSnippetRow.tsx';
import CommandSnippetCreateModal from './modals/CommandSnippetCreateModal.tsx';

export default function DashboardCommandSnippets() {
  const { t } = useTranslations();
  const { commandSnippets, setCommandSnippets } = useUserStore();
  const { settings } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.commandSnippets.all(),
    fetcher: getCommandSnippets,
    setStoreData: setCommandSnippets,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.commandSnippets.title', {})}
      subtitle={t('pages.account.commandSnippets.subtitle', {
        current: commandSnippets.total,
        max: settings.user.maxCommandSnippetCount,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ConditionalTooltip
          enabled={commandSnippets.total >= settings.user.maxCommandSnippetCount}
          label={t('pages.account.commandSnippets.tooltip.limitReached', { max: settings.user.maxCommandSnippetCount })}
        >
          <Button
            onClick={() => setOpenModal('create')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
            disabled={commandSnippets.total >= settings.user.maxCommandSnippetCount}
          >
            {t('common.button.create', {})}
          </Button>
        </ConditionalTooltip>
      }
      registry={window.extensionContext.extensionRegistry.pages.dashboard.commandSnippets.container}
    >
      <CommandSnippetCreateModal opened={openModal === 'create'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
          columns={[
            t('common.table.columns.name', {}),
            t('pages.account.commandSnippets.table.columns.eggs', {}),
            t('common.table.columns.created', {}),
            '',
          ]}
          loading={loading}
          pagination={commandSnippets}
          onPageSelect={setPage}
        >
          {commandSnippets.data.map((snippet) => (
            <CommandSnippetRow key={snippet.uuid} commandSnippet={snippet} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

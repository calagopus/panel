import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import getCommandSnippets from '@/api/me/command-snippets/getCommandSnippets.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CommandSnippetRow from './CommandSnippetRow.tsx';
import CommandSnippetCreateModal from './modals/CommandSnippetCreateModal.tsx';

export default function DashboardCommandSnippets() {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.commandSnippets.all(),
    fetcher: getCommandSnippets,
  });

  const commandSnippets = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AccountContentContainer
      title={t('pages.account.commandSnippets.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.create', {})}
        </Button>
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

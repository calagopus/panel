import { getEmptyPaginationSet } from '@/api/axios.ts';
import getSessions from '@/api/me/sessions/getSessions.ts';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SessionRow from './SessionRow.tsx';

export default function DashboardSessions() {
  const { t } = useTranslations();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sessions.all(),
    fetcher: getSessions,
  });

  const sessions = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AccountContentContainer
      title={t('pages.account.sessions.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.sessions.container}
    >
      <ContextMenuProvider>
        <Table
          columns={[
            t('pages.account.sessions.table.columns.ip', {}),
            t('pages.account.sessions.table.columns.thisDevice', {}),
            t('pages.account.sessions.table.columns.userAgent', {}),
            t('common.table.columns.lastUsed', {}),
            '',
          ]}
          loading={loading}
          pagination={sessions}
          onPageSelect={setPage}
        >
          {sessions.data.map((session) => (
            <SessionRow key={session.uuid} session={session} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AccountContentContainer>
  );
}

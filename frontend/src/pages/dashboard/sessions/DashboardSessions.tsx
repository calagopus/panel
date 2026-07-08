import getSessions from '@/api/me/sessions/getSessions.ts';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import SessionRow from './SessionRow.tsx';

export default function DashboardSessions() {
  const { t } = useTranslations();
  const sessions = useUserStore((state) => state.sessions);
  const setSessions = useUserStore((state) => state.setSessions);

  const { loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.sessions.all(),
    fetcher: getSessions,
    setStoreData: setSessions,
  });

  return (
    <AccountContentContainer
      title={t('pages.account.sessions.title', {})}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.sessions.container}
    >
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
        error={error}
      >
        {sessions.data.map((session) => (
          <SessionRow key={session.uuid} session={session} />
        ))}
      </Table>
    </AccountContentContainer>
  );
}

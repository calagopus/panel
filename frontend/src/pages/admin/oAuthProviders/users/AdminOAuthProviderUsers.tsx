import { z } from 'zod';
import getOAuthProviderUsers from '@/api/admin/oauth-providers/users/getOAuthProviderUsers.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminOAuthProviderUsersTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import UserOAuthLinkRow from './UserOAuthLinkRow.tsx';

export default function AdminOAuthProviderUsers({
  oauthProvider,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { t } = useTranslations();

  const {
    data: oauthProviderUsers,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.oAuthProviders.users(oauthProvider.uuid),
    fetcher: (page, search) => getOAuthProviderUsers(oauthProvider.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.oAuthProviders.tabs.users.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
    >
      <Table
        columns={adminOAuthProviderUsersTableColumns()}
        loading={loading}
        pagination={oauthProviderUsers}
        onPageSelect={setPage}
      >
        {oauthProviderUsers?.data.map((userOAuthLink) => (
          <UserOAuthLinkRow key={userOAuthLink.uuid} userOAuthLink={userOAuthLink} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}

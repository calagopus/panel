import { faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getOAuthProviderUsers from '@/api/admin/oauth-providers/users/getOAuthProviderUsers.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminOAuthProviderUsersTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import IdentifierLookupModal from './modals/IdentifierLookupModal.tsx';
import UserOAuthLinkRow from './UserOAuthLinkRow.tsx';

export default function AdminOAuthProviderUsers({
  oauthProvider,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'lookup' | null>(null);

  const {
    data: oauthProviderUsers,
    loading,
    error,
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
      contentRight={
        <>
          <IdentifierLookupModal
            oauthProviderUuid={oauthProvider.uuid}
            opened={openModal === 'lookup'}
            onClose={() => setOpenModal(null)}
          />
          <AdminCan action='oauth-providers.read'>
            <Button
              onClick={() => setOpenModal('lookup')}
              variant='default'
              leftSection={<FontAwesomeIcon icon={faFingerprint} />}
            >
              {t('pages.admin.oAuthProviders.tabs.users.identifierLookup.button', {})}
            </Button>
          </AdminCan>
        </>
      }
    >
      <Table
        columns={adminOAuthProviderUsersTableColumns()}
        loading={loading}
        error={error}
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

import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getUserOAuthLinks from '@/api/admin/users/oauthLinks/getUserOAuthLinks.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { adminUserOAuthLinkTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import UserOAuthLinkAddModal from './modals/UserOAuthLinkAddModal.tsx';
import UserOAuthLinkRow from './UserOAuthLinkRow.tsx';

export default function AdminUserOAuthLinks({ user }: { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: userOAuthLinks,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.oauthLinks(user.uuid),
    fetcher: (page, search) => getUserOAuthLinks(user.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.users.tabs.oauthLinks.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.users.view.oauthLinks.subContainer}
      registryProps={{ user }}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <UserOAuthLinkAddModal user={user} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />

      <Table
        columns={adminUserOAuthLinkTableColumns()}
        loading={loading}
        error={error}
        pagination={userOAuthLinks}
        onPageSelect={setPage}
      >
        {userOAuthLinks?.data.map((userOAuthLink) => (
          <UserOAuthLinkRow key={userOAuthLink.uuid} user={user} userOAuthLink={userOAuthLink} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}

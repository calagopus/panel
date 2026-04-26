import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getUserOAuthLinks from '@/api/admin/users/oauthLinks/getUserOAuthLinks.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { adminUserOAuthLinkTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import UserOAuthLinkAddModal from './modals/UserOAuthLinkAddModal.tsx';
import UserOAuthLinkRow from './UserOAuthLinkRow.tsx';

export default function AdminUserOAuthLinks({ user }: { user: z.infer<typeof fullUserSchema> }) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.oauthLinks(user.uuid),
    fetcher: (page, search) => getUserOAuthLinks(user.uuid, page, search),
  });

  const userOAuthLinks = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer
      title='User OAuth Links'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          Add
        </Button>
      }
    >
      <UserOAuthLinkAddModal user={user} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />

      <ContextMenuProvider>
        <Table
          columns={adminUserOAuthLinkTableColumns}
          loading={loading}
          pagination={userOAuthLinks}
          onPageSelect={setPage}
        >
          {userOAuthLinks.data.map((userOAuthLink) => (
            <UserOAuthLinkRow key={userOAuthLink.uuid} user={user} userOAuthLink={userOAuthLink} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}

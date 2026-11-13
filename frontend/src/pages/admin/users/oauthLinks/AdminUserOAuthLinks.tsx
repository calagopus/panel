import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getUserOAuthLinks from '@/api/admin/users/oauthLinks/getUserOAuthLinks.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { adminUserOAuthLinkTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import UserOAuthLinkAddModal from './modals/UserOAuthLinkAddModal.tsx';
import UserOAuthLinkRow from './UserOAuthLinkRow.tsx';

export default function AdminUserOAuthLinks({ user }: { user: z.infer<typeof adminFullUserSchema> }) {
  const { t } = useTranslations();
  const { user: currentUser } = useAuth();

  const canLink = !!currentUser?.admin || currentUser?.uuid === user.uuid;
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: userOAuthLinks,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.users.oauthLinks(user.uuid),
    fetcher: (page, search, perPage) => getUserOAuthLinks(user.uuid, page, search, perPage),
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
        <AdminCan action='oauth-providers.read'>
          <ConditionalTooltip
            enabled={!canLink}
            label={t('pages.admin.users.tabs.oauthLinks.page.tooltip.rootOnly', {})}
          >
            <Button
              onClick={() => setOpenModal('add')}
              color='blue'
              disabled={!canLink}
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.add', {})}
            </Button>
          </ConditionalTooltip>
        </AdminCan>
      }
    >
      <AdminCan action='oauth-providers.read'>
        <UserOAuthLinkAddModal user={user} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={adminUserOAuthLinkTableColumns()}
        loading={loading}
        error={error}
        pagination={userOAuthLinks}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {userOAuthLinks?.data.map((userOAuthLink) => (
          <UserOAuthLinkRow key={userOAuthLink.uuid} user={user} userOAuthLink={userOAuthLink} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}

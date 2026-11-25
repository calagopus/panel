import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getTeamMembers from '@/api/admin/teams/members/getTeamMembers.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminTeamMemberRow from './AdminTeamMemberRow.tsx';
import TeamMemberCreateModal from './modals/TeamMemberCreateModal.tsx';

export default function AdminTeamMembers({ team }: { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: members,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.teams.members(team.uuid),
    fetcher: (page, search, perPage) => getTeamMembers(team.uuid, page, search, perPage),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.teams.tabs.members.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.members.subContainer}
      registryProps={{ team }}
      contentRight={
        <AdminCan action={['teams.update', 'users.read']}>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action={['teams.update', 'users.read']}>
        <TeamMemberCreateModal team={team} opened={openModal === 'create'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[
          '',
          t('common.table.columns.username', {}),
          t('pages.account.teams.table.columns.preset', {}),
          t('pages.account.teams.table.columns.management', {}),
          t('pages.account.teams.table.columns.joined', {}),
          '',
        ]}
        loading={loading}
        pagination={members}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {members?.data.map((member) => (
          <AdminTeamMemberRow key={member.user.uuid} team={team} member={member} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}

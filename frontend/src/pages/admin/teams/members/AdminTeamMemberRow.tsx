import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteTeamMember from '@/api/admin/teams/members/deleteTeamMember.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Avatar from '@/elements/data-display/Avatar.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { teamManagementLabel } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamMemberSchema, adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface AdminTeamMemberRowProps {
  team: z.infer<typeof adminTeamSchema>;
  member: z.infer<typeof adminTeamMemberSchema>;
}

export default function AdminTeamMemberRow({ team, member }: AdminTeamMemberRowProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteTeamMember(team.uuid, member.user.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.account.teams.tabs.members.modal.removeMember.toast.removed', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.teams.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.teams.tabs.members.modal.removeMember.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.account.teams.tabs.members.modal.removeMember.content', {
          username: member.user.username,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('teams.update'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.teams.view.members.contextMenu}
        registryProps={{ team, member }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <div className='size-5 aspect-square relative'>
                <Avatar size={20} className='select-none' src={member.user.avatar} name={member.user.username} />
              </div>
            </TableData>

            <TableData>
              <TableLink to={`/admin/users/${member.user.uuid}`}>{member.user.username}</TableLink>
            </TableData>

            <TableData>{member.preset.name}</TableData>

            <TableData>{teamManagementLabel(member.management)}</TableData>

            <TableData>
              {member.accepted ? (
                <FormattedTimestamp timestamp={member.accepted} />
              ) : (
                <Badge color='yellow'>{t('pages.account.teams.badge.invited', {})}</Badge>
              )}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}

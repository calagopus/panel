import { faLock, faLockOpen, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTeamMember from '@/api/me/teams/members/deleteTeamMember.ts';
import Avatar from '@/elements/data-display/Avatar.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { canRemoveTeamMember, outranksTeamPreset, teamManagementLabel } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamMemberSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamMemberUpdateModal from './modals/TeamMemberUpdateModal.tsx';

interface TeamMemberRowProps {
  team: z.infer<typeof userTeamSchema>;
  member: z.infer<typeof userTeamMemberSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const TeamMemberRow = forwardRef<HTMLTableRowElement, TeamMemberRowProps>(function TeamMemberRow(
  { team, member, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'update' | 'remove' | null>(null);

  const isSelf = member.user.uuid === user?.uuid;
  const outranks = !isSelf && outranksTeamPreset(team, member.preset);
  const canRemove = canRemoveTeamMember(team, member, user?.uuid);

  const doRemove = async () => {
    await deleteTeamMember(team.uuid, member.user.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.account.teams.tabs.members.modal.removeMember.toast.removed', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <TeamMemberUpdateModal
        team={team}
        member={member}
        opened={openModal === 'update'}
        onClose={() => setOpenModal(null)}
      />

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
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('update'),
            color: 'gray',
            canAccess: outranks,
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: canRemove,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.view.members.contextMenu}
        registryProps={{ team, member }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={member.user.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <div className='size-5 aspect-square relative'>
                <Avatar size={20} className='select-none' src={member.user.avatar} name={member.user.username} />
              </div>
            </TableData>

            <TableData>{member.user.username}</TableData>

            <TableData>{member.preset.name}</TableData>

            <TableData>{teamManagementLabel(member.management)}</TableData>

            <TableData>
              {member.user.totpEnabled ? (
                <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
              )}
            </TableData>

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
});

export default TeamMemberRow;

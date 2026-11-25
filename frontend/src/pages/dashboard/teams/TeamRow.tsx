import { faArrowRightFromBracket, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import acceptTeamInvite from '@/api/me/teams/acceptTeamInvite.ts';
import getTeamCounts from '@/api/me/teams/getTeamCounts.ts';
import leaveTeam from '@/api/me/teams/leaveTeam.ts';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isTeamInvitePending, isTeamMember, isTeamOwner } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamDeleteModal from './modals/TeamDeleteModal.tsx';
import TeamLeaveModal from './modals/TeamLeaveModal.tsx';

export default function TeamRow({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'leave' | 'delete' | null>(null);
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);

  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.user.teams.counts(),
    queryFn: getTeamCounts,
    silent: true,
  });

  const pending = isTeamInvitePending(team);

  const doAnswer = (answer: 'accept' | 'decline') => {
    setLoading(answer);

    (answer === 'accept' ? acceptTeamInvite(team.uuid) : leaveTeam(team.uuid))
      .then(() => {
        addToast(
          answer === 'accept'
            ? t('pages.account.teams.toast.inviteAccepted', {})
            : t('pages.account.teams.toast.inviteDeclined', {}),
          'success',
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(null));
  };

  return (
    <>
      <TeamDeleteModal team={team} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />
      <TeamLeaveModal team={team} opened={openModal === 'leave'} onClose={() => setOpenModal(null)} />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faArrowRightFromBracket,
            label: t('pages.account.teams.button.leave', {}),
            hidden: isTeamOwner(team) || pending,
            onClick: () => setOpenModal('leave'),
            color: 'red',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            hidden: !isTeamOwner(team),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.dashboard.teams.teamContextMenu}
        registryProps={{ team }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              {pending ? team.name : <TableLink to={`/account/teams/${team.uuid}`}>{team.name}</TableLink>}
            </TableData>

            <TableData>{team.owner.username}</TableData>

            <TableData>
              {!isTeamMember(team) ? (
                <Badge color='blue'>{t('pages.account.teams.badge.owner', {})}</Badge>
              ) : pending ? (
                <Badge color='yellow'>{t('pages.account.teams.badge.invited', {})}</Badge>
              ) : (
                team.membership.preset.name
              )}
            </TableData>

            <TableData>
              {counts ? (counts[team.uuid]?.teamServers ?? 0) : countsLoading && <Spinner size={16} />}
            </TableData>

            <TableData>
              {counts ? (counts[team.uuid]?.teamMembers ?? 0) : countsLoading && <Spinner size={16} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={team.created} />
            </TableData>

            <TableData>
              {pending && (
                <Group gap='xs' justify='flex-end' wrap='nowrap'>
                  <Button
                    size='compact-sm'
                    color='green'
                    loading={loading === 'accept'}
                    disabled={loading !== null}
                    onClick={() => doAnswer('accept')}
                  >
                    {t('pages.account.teams.button.accept', {})}
                  </Button>
                  <Button
                    size='compact-sm'
                    variant='default'
                    loading={loading === 'decline'}
                    disabled={loading !== null}
                    onClick={() => doAnswer('decline')}
                  >
                    {t('pages.account.teams.button.decline', {})}
                  </Button>
                </Group>
              )}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}

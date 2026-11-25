import { z } from 'zod';
import getTeamCounts from '@/api/admin/teams/getTeamCounts.ts';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { isTeamInvitePending, isTeamMember } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UserTeamRow({ team }: { team: z.infer<typeof adminTeamSchema> }) {
  const { t } = useTranslations();

  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.teams.counts(),
    queryFn: getTeamCounts,
    silent: true,
  });

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/teams/${team.uuid}`}>
          <Code>{team.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{team.name}</TableData>

      <TableData>
        <TableLink to={`/admin/users/${team.owner.uuid}`}>{team.owner.username}</TableLink>
      </TableData>

      <TableData>
        {!isTeamMember(team) ? (
          <Badge color='blue'>{t('pages.account.teams.badge.owner', {})}</Badge>
        ) : isTeamInvitePending(team) ? (
          <Badge color='yellow'>{t('pages.account.teams.badge.invited', {})}</Badge>
        ) : (
          team.membership.preset.name
        )}
      </TableData>

      <TableData>{counts ? (counts[team.uuid]?.teamServers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>{counts ? (counts[team.uuid]?.teamMembers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={team.created} />
      </TableData>
    </TableRow>
  );
}

import { z } from 'zod';
import getSystemBackupPolicyLatestRuns from '@/api/admin/system-backup-policies/getSystemBackupPolicyLatestRuns.ts';
import BackupRetentionBadge from '@/elements/data-display/BackupRetentionBadge.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { getSystemBackupPolicyRunState, systemBackupPolicyRunStateInfo } from '@/lib/domain/systemBackupPolicyRun.ts';
import { serverBackupKindLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyRow({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const { data: latestRuns, loading: latestRunsLoading } = useResource({
    queryKey: queryKeys.admin.systemBackupPolicies.latestRuns(),
    queryFn: getSystemBackupPolicyLatestRuns,
    silent: true,
  });

  const latestRun = latestRuns?.[systemBackupPolicy.uuid];
  const latestRunState = latestRun ? systemBackupPolicyRunStateInfo[getSystemBackupPolicyRunState(latestRun)] : null;

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/system-backup-policies/${systemBackupPolicy.uuid}`}>
          <Code>{systemBackupPolicy.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>
        {systemBackupPolicy.name}
        <Badge color={systemBackupPolicy.kind === 'server' ? 'gray' : 'blue'} variant='light' className='ml-2'>
          {serverBackupKindLabelMapping[systemBackupPolicy.kind]()}
        </Badge>
        <BackupRetentionBadge retention={systemBackupPolicy.retention} className='ml-2' />
        {!systemBackupPolicy.enabled && (
          <Badge color='gray' className='ml-2'>
            {t('common.badge.disabled', {})}
          </Badge>
        )}
      </TableData>
      <TableData>
        <Code>{systemBackupPolicy.cron}</Code>
      </TableData>
      <TableData>{systemBackupPolicy.totalBackups}</TableData>
      <TableData>
        {latestRuns
          ? latestRun &&
            latestRunState && (
              <Group gap='xs'>
                <Badge color={latestRunState.badgeColor}>{latestRunState.label()}</Badge>
                <FormattedTimestamp timestamp={latestRun.created} />
              </Group>
            )
          : latestRunsLoading && <Spinner size={16} />}
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={systemBackupPolicy.created} />
      </TableData>
    </TableRow>
  );
}

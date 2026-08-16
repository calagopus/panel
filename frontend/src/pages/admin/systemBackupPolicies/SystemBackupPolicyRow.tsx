import { z } from 'zod';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyRow({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/system-backup-policies/${systemBackupPolicy.uuid}`}>
          <Code>{systemBackupPolicy.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>
        {systemBackupPolicy.name}
        {!systemBackupPolicy.enabled && (
          <Badge color='gray' className='ml-2'>
            {t('pages.admin.systemBackupPolicies.badge.disabled', {})}
          </Badge>
        )}
        {systemBackupPolicy.triggered && (
          <Badge color='yellow' className='ml-2'>
            {t('pages.admin.systemBackupPolicies.badge.runPending', {})}
          </Badge>
        )}
      </TableData>
      <TableData>
        <Code>{systemBackupPolicy.cron}</Code>
      </TableData>
      <TableData>{systemBackupPolicy.totalBackups}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={systemBackupPolicy.created} />
      </TableData>
    </TableRow>
  );
}

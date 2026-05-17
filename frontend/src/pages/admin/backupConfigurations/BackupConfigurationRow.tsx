import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';

export default function BackupConfigurationRow({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/backup-configurations/${backupConfiguration.uuid}`}>
          <Code>{backupConfiguration.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{backupConfiguration.name}</TableData>
      <TableData>{backupDiskLabelMapping[backupConfiguration.backupDisk]}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={backupConfiguration.created} />
      </TableData>
    </TableRow>
  );
}

import { z } from 'zod';
import Badge from '@/elements/data-display/Badge.tsx';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import {
  getSystemBackupPolicyRunTargetState,
  systemBackupPolicyRunTargetStateInfo,
} from '@/lib/domain/systemBackupPolicyRun.ts';
import { systemBackupPolicyRunTargetReasonLabelMapping } from '@/lib/enums.ts';
import { adminSystemBackupPolicyRunTargetSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';

export default function SystemBackupPolicyRunTargetRow({
  target,
  showSource,
}: {
  target: z.infer<typeof adminSystemBackupPolicyRunTargetSchema>;
  showSource: boolean;
}) {
  const state = systemBackupPolicyRunTargetStateInfo[getSystemBackupPolicyRunTargetState(target)];

  return (
    <TableRow>
      {showSource && <TableData>{target.databaseInstanceName}</TableData>}
      <TableData>
        {target.server && <TableLink to={`/admin/servers/${target.server.uuid}`}>{target.server.name}</TableLink>}
      </TableData>
      <TableData>
        {target.server && (
          <TableLink to={`/admin/nodes/${target.server.node.uuid}`}>
            <Code>{target.server.node.name}</Code>
          </TableLink>
        )}
      </TableData>
      <TableData>
        <Badge color={state.badgeColor} variant='light'>
          {state.label()}
        </Badge>
      </TableData>
      <TableData>{target.reason && systemBackupPolicyRunTargetReasonLabelMapping[target.reason]()}</TableData>
      <TableData>
        <FormattedTimestamp timestamp={target.updated} />
      </TableData>
    </TableRow>
  );
}

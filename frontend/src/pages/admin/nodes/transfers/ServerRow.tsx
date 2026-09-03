import { forwardRef, memo } from 'react';
import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { bytesProgressString, bytesToString } from '@/lib/format/size.ts';
import { adminNodeTransferProgressSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type TransferProgressWithRates = z.infer<typeof adminNodeTransferProgressSchema> & {
  archiveRate: number;
  networkRate: number;
};

interface ServerRowProps {
  server: z.infer<typeof adminServerSchema>;
  transferProgress?: TransferProgressWithRates;
}

const ServerRow = memo(
  forwardRef<HTMLTableRowElement, ServerRowProps>(function ServerRow({ server, transferProgress }, ref) {
    const { tItem } = useTranslations();

    return (
      <TableRow ref={ref}>
        <TableData>
          <TableLink to={`/admin/servers/${server.uuid}`}>
            <Code>{server.uuid}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <Tooltip
            label={`${bytesProgressString(transferProgress?.archiveBytesProcessed || 0, transferProgress?.bytesTotal || 0)} · ${tItem('file', transferProgress?.filesProcessed || 0)}`}
            innerClassName='w-full'
          >
            <Progress
              indeterminate={!transferProgress?.bytesTotal}
              value={((transferProgress?.archiveBytesProcessed || 0) / (transferProgress?.bytesTotal || 1)) * 100}
            />
          </Tooltip>
        </TableData>

        <TableData>{bytesToString(transferProgress?.archiveRate || 0)}/s</TableData>

        <TableData>{bytesToString(transferProgress?.networkRate || 0)}/s</TableData>

        <TableData>{server.name}</TableData>

        <TableData>
          <TableLink to={`/admin/nodes/${server.node.uuid}`}>
            <Code>{server.node.name}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <TableLink to={`/admin/users/${server.owner.uuid}`}>
            <Code>{server.owner.username}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <FormattedTimestamp timestamp={server.created} />
        </TableData>
      </TableRow>
    );
  }),
);

export default ServerRow;

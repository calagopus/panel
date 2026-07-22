import { forwardRef, memo, useRef } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Progress from '@/elements/Progress.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminNodeTransferProgressSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { bytesProgressString, bytesToString } from '@/lib/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ServerRowProps {
  server: z.infer<typeof adminServerSchema>;
  transferProgress?: z.infer<typeof adminNodeTransferProgressSchema>;
}

const ServerRow = memo(
  forwardRef<HTMLTableRowElement, ServerRowProps>(function ServerRow({ server, transferProgress }, ref) {
    const { tItem } = useTranslations();
    const lastProgress = useRef(transferProgress);

    const archiveRate =
      lastProgress.current && transferProgress
        ? transferProgress.archiveBytesProcessed - lastProgress.current.archiveBytesProcessed
        : 0;
    const networkRate =
      lastProgress.current && transferProgress
        ? transferProgress.networkBytesProcessed - lastProgress.current.networkBytesProcessed
        : 0;

    if (transferProgress) {
      lastProgress.current = transferProgress;
    }

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

        <TableData>{bytesToString(archiveRate)}/s</TableData>

        <TableData>{bytesToString(networkRate)}/s</TableData>

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

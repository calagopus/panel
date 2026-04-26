import {
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import getGeneralHealth from '@/api/admin/system/health/getGeneralHealth.ts';
import getNodesHealth from '@/api/admin/system/health/getNodesHealth.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminOverviewHealth() {
  const { addToast } = useToast();

  const [general, setGeneral] = useState<Awaited<ReturnType<typeof getGeneralHealth>> | null>(null);

  const { data, loading, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.health.nodes(),
    fetcher: (page) => getNodesHealth(page),
    paginationKey: 'desyncNodes',
  });

  const nodes = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  useEffect(() => {
    getGeneralHealth()
      .then(setGeneral)
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });
  }, []);

  const avgNtpOffset =
    general && general.ntpOffsets
      ? Object.values(general.ntpOffsets)
          .filter((o) => o.offsetMicros !== 0)
          .reduce((acc, o) => acc + Math.abs(o.offsetMicros), 0) /
        Object.values(general.ntpOffsets).length /
        1000
      : 0;

  return (
    <>
      <div className='2xl:columns-2 gap-4 space-y-4'>
        <TitleCard title='General Health' icon={<FontAwesomeIcon icon={faInfoCircle} />}>
          {!general ? (
            <Spinner.Centered />
          ) : (
            <>
              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
                <Card className='flex col-span-2'>
                  <Title order={3} c='white'>
                    {general.migrations.applied} / {general.migrations.total}
                  </Title>
                  Applied Migrations ({((general.migrations.applied / general.migrations.total) * 100).toFixed(2)}%)
                </Card>
                <Card className='flex col-span-2'>
                  <Title order={3} c={avgNtpOffset > 100 ? 'yellow' : 'white'}>
                    {avgNtpOffset.toFixed(2)} ms
                  </Title>
                  Avg. NTP Offset
                </Card>
              </div>
            </>
          )}
        </TitleCard>
        <TitleCard title='Extension Migration Health' icon={<FontAwesomeIcon icon={faPuzzlePiece} />}>
          {!general ? (
            <Spinner.Centered />
          ) : !Object.keys(general.migrations.extensions).length ? (
            <>No extensions found.</>
          ) : (
            <>
              {Object.keys(general.migrations.extensions).length > 0 && (
                <Table columns={['Package Name', 'Applied', 'Total']} loading={loading}>
                  {Object.entries(general.migrations.extensions).map(([identifier, migrations]) => (
                    <TableRow key={identifier}>
                      <TableData>
                        <Code>{identifier}</Code>
                      </TableData>
                      <TableData>
                        {migrations.applied} (
                        {(migrations.total === 0 ? 100 : (migrations.applied / migrations.total) * 100).toFixed(2)}%)
                      </TableData>
                      <TableData>{migrations.total}</TableData>
                    </TableRow>
                  ))}
                </Table>
              )}
            </>
          )}
        </TitleCard>
        <TitleCard title='Desync Nodes' icon={<FontAwesomeIcon icon={faServer} />}>
          {loading || !nodes?.desyncNodes ? (
            <Spinner.Centered />
          ) : !nodes?.desyncNodes.total ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> Seems like all nodes have a synced clock (within 5 seconds of panel
              clock). ({nodes?.failedNodes} failed to check)
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Some nodes have desync clocks (over 5 seconds off of the
              panel's clock). This can cause file download/console issues. ({nodes?.desyncNodes.total} desync,{' '}
              {nodes?.failedNodes} failed to check)
              <div className='mt-4' />
              <Table
                columns={['', 'ID', 'Desync', ...nodeTableColumns.slice(2)]}
                loading={loading}
                pagination={nodes.desyncNodes}
                onPageSelect={setPage}
              >
                {nodes.desyncNodes.data.map((node) => (
                  <NodeRow
                    key={node.node.uuid}
                    node={node.node}
                    desync={Math.abs(new Date(node.localTime).getTime() - new Date(node.panelLocalTime).getTime())}
                  />
                ))}
              </Table>
            </>
          )}
        </TitleCard>
      </div>
    </>
  );
}

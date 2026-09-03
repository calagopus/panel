import {
  faArrowDown,
  faArrowUp,
  faDiagramProject,
  faLink,
  faPlug,
  faStopwatch,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getNodeTunnelMetrics from '@/api/admin/nodes/tunnel/getNodeTunnelMetrics.ts';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import StatCard from '@/elements/data-display/StatCard.tsx';
import Table, { TableData, TableHeaderProps, TableRow } from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeTunnelMetricsSchema, adminNodeTunnelPeerMetricsSchema } from '@/lib/schemas/admin/nodeTunnel.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useWebsocket } from '@/plugins/websocket/useWebsocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Peer = z.infer<typeof adminNodeTunnelPeerMetricsSchema>;

const DROP_REASONS = [
  'sendBufferFull',
  'unknownFlow',
  'fragTimeout',
  'fragLimit',
  'oversize',
  'malformed',
] as const satisfies (keyof Peer['drops'])[];

function column(name: string, hint?: string): TableHeaderProps {
  return { name, hint };
}

function PeerRow({ peer }: { peer: Peer }) {
  const { t } = useTranslations();

  const dropped = DROP_REASONS.reduce((total, reason) => total + peer.drops[reason], 0);
  const breakdown = DROP_REASONS.filter((reason) => peer.drops[reason] > 0)
    .map((reason) => `${t(`pages.admin.nodes.tabs.tunnel.page.metrics.drop.${reason}`, {})}: ${peer.drops[reason]}`)
    .join(', ');

  return (
    <TableRow>
      <TableData>
        <Stack gap={0}>
          <Text>{peer.name}</Text>
          <Text size='xs' c='dimmed'>
            {peer.uuid}
          </Text>
        </Stack>
      </TableData>
      <TableData>
        <Tooltip
          label={
            peer.role === 'initiator'
              ? t('pages.admin.nodes.tabs.tunnel.page.metrics.tooltip.roleInitiator', {})
              : t('pages.admin.nodes.tabs.tunnel.page.metrics.tooltip.roleAcceptor', {})
          }
        >
          <Badge className='w-max!' variant='default' tt='none'>
            {peer.role === 'initiator'
              ? t('pages.admin.nodes.tabs.tunnel.page.metrics.role.initiator', {})
              : t('pages.admin.nodes.tabs.tunnel.page.metrics.role.acceptor', {})}
          </Badge>
        </Tooltip>
      </TableData>
      <TableData>
        <CopyOnClick content={peer.remoteAddr}>{peer.remoteAddr}</CopyOnClick>
      </TableData>
      <TableData>
        {t('pages.admin.nodes.tabs.tunnel.page.metrics.value.path', {
          rtt: peer.path.rttMs.toFixed(1),
          mtu: String(peer.path.currentMtu),
        })}
      </TableData>
      <TableData>
        {peer.path.lostPackets === 0 && peer.path.congestionEvents === 0 ? (
          <Text c='dimmed'>0 / 0</Text>
        ) : (
          <Text>
            {peer.path.lostPackets} / {peer.path.congestionEvents}
          </Text>
        )}
      </TableData>
      <TableData>
        <Group gap='sm' wrap='nowrap'>
          <Text size='sm'>
            <FontAwesomeIcon icon={faArrowDown} size='xs' />{' '}
            {bytesToString(peer.relay.streamBytesIn + peer.relay.datagramBytesIn)}
          </Text>
          <Text size='sm'>
            <FontAwesomeIcon icon={faArrowUp} size='xs' />{' '}
            {bytesToString(peer.relay.streamBytesOut + peer.relay.datagramBytesOut)}
          </Text>
        </Group>
      </TableData>
      <TableData>
        {peer.relay.streamsOpen} / {peer.relay.streamsTotal}
      </TableData>
      <TableData>
        <Stack gap={0}>
          <Text>
            {peer.flows.open} / {peer.flows.openedTotal}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.admin.nodes.tabs.tunnel.page.metrics.value.tcpOpen', { count: peer.flows.tcpOpen })}
          </Text>
        </Stack>
      </TableData>
      <TableData>
        {dropped === 0 ? (
          <Text c='dimmed'>0</Text>
        ) : (
          <Tooltip label={breakdown}>
            <Text c='red'>{dropped}</Text>
          </Tooltip>
        )}
      </TableData>
      <TableData>{formatMilliseconds(peer.establishedSecs * 1000)}</TableData>
    </TableRow>
  );
}

export default function AdminNodeTunnelMetrics({ nodeUuid }: { nodeUuid: string }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [live, setLive] = useState<z.infer<typeof adminNodeTunnelMetricsSchema> | null>(null);

  const { data: initial, error } = useResource({
    queryKey: queryKeys.admin.nodes.tunnelMetrics(nodeUuid),
    queryFn: () => getNodeTunnelMetrics(nodeUuid),
  });

  useWebsocket({
    path: `/api/admin/nodes/${nodeUuid}/tunnel/metrics/ws`,
    schema: adminNodeTunnelMetricsSchema,
    reconnectDelay: 5000,
    onMessage: setLive,
    onConnectionLost: () => {
      setLive(null);
      addToast(t('pages.admin.nodes.tabs.tunnel.page.toast.connectionLost', {}), 'error');
    },
  });

  const data = live ?? initial;

  if (!data) {
    return (
      <TitleCard title={t('pages.admin.nodes.tabs.tunnel.page.metrics.title', {})}>
        <Text c='dimmed' size='sm'>
          {error
            ? t('pages.admin.nodes.tabs.tunnel.page.metrics.unreachable', {})
            : t('pages.admin.nodes.tabs.tunnel.page.metrics.loading', {})}
        </Text>
      </TitleCard>
    );
  }

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 5 }}>
        <StatCard
          icon={faDiagramProject}
          label={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.peers', {})}
          value={String(data.node.peersConnected)}
        />
        <StatCard
          icon={faStopwatch}
          label={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.uptime', {})}
          value={formatMilliseconds(data.node.uptimeSecs * 1000)}
        />
        <StatCard
          icon={faLink}
          label={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.controlLink', {})}
          value={
            data.node.remoteLink === 'up'
              ? t('pages.admin.nodes.tabs.tunnel.page.metrics.value.linkUp', {})
              : t('pages.admin.nodes.tabs.tunnel.page.metrics.value.linkDown', {})
          }
        />
        <StatCard
          icon={faPlug}
          label={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.frontends', {})}
          value={String(data.node.frontends)}
          details={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.flowsOpen', { count: data.node.localFlowsOpen })}
        />
        <StatCard
          icon={faTrash}
          label={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.localDrops', {})}
          value={String(data.node.localDrops)}
          details={t('pages.admin.nodes.tabs.tunnel.page.metrics.stat.frozenFlows', { count: data.node.frozenFlows })}
        />
      </SimpleGrid>

      <TitleCard
        title={t('pages.admin.nodes.tabs.tunnel.page.metrics.title', {})}
        rightSection={
          <Text size='xs' c='dimmed' ml='auto'>
            {t('pages.admin.nodes.tabs.tunnel.page.metrics.applied', {
              epoch: data.node.epoch,
              snapshots: data.node.snapshotsApplied,
            })}
          </Text>
        }
        wrapperClassName='p-0!'
      >
        <Table
          flush
          columns={[
            column(t('pages.admin.nodes.tabs.tunnel.page.metrics.column.peer', {})),
            column(t('pages.admin.nodes.tabs.tunnel.page.metrics.column.role', {})),
            column(t('pages.admin.nodes.tabs.tunnel.page.metrics.column.address', {})),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.path', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.rttMtu', {}),
            ),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.loss', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.packetsEvents', {}),
            ),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.transferred', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.inOut', {}),
            ),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.streams', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.openTotal', {}),
            ),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.flows', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.udpOpenTotal', {}),
            ),
            column(
              t('pages.admin.nodes.tabs.tunnel.page.metrics.column.drops', {}),
              t('pages.admin.nodes.tabs.tunnel.page.metrics.hint.datagrams', {}),
            ),
            column(t('pages.admin.nodes.tabs.tunnel.page.metrics.column.connected', {})),
          ]}
          pagination={{ total: data.peers.length, perPage: data.peers.length, page: 1, data: data.peers }}
        >
          {data.peers.map((peer) => (
            <PeerRow key={peer.uuid} peer={peer} />
          ))}
        </Table>
      </TitleCard>
    </Stack>
  );
}

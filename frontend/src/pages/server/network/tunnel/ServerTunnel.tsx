import {
  faExclamationTriangle,
  faPen,
  faPlug,
  faPlus,
  faRightFromBracket,
  faRightToBracket,
  faShareNodes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTunnelConnection from '@/api/server/tunnel/deleteTunnelConnection.ts';
import getTunnel from '@/api/server/tunnel/getTunnel.ts';
import leaveTunnel from '@/api/server/tunnel/leaveTunnel.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { ContextMenuItem, useHideContextMenu } from '@/elements/overlays/ContextMenu.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverTunnelPeerSchema } from '@/lib/schemas/server/tunnel.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import NetworkSubNavigation from '../NetworkSubNavigation.tsx';
import { tunnelAddresses } from './directions.ts';
import ConnectServerModal from './modals/ConnectServerModal.tsx';
import JoinTunnelModal from './modals/JoinTunnelModal.tsx';
import RenameTunnelModal from './modals/RenameTunnelModal.tsx';
import TunnelPortsModal from './modals/TunnelPortsModal.tsx';
import TunnelCanvas, { CanvasEdge, CanvasNode } from './TunnelCanvas.tsx';
import TunnelNode from './TunnelNode.tsx';

type Peer = z.infer<typeof serverTunnelPeerSchema>;
type Disconnecting = { peer: Peer; incoming: boolean };

export default function ServerTunnel() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const canCreate = useServerCan('connections.create');
  const canUpdate = useServerCan('connections.update');
  const canDelete = useServerCan('connections.delete');
  const maxConnections = useGlobalStore((state) => state.settings.server.maxTunnelConnectionCount);
  const hideContextMenu = useHideContextMenu();

  const tunnel = useResource({
    queryKey: queryKeys.server(server.uuid).tunnel.all(),
    queryFn: () => getTunnel(server.uuid),
  });

  const [editingPorts, setEditingPorts] = useState(false);
  const [connecting, setConnecting] = useState<{ serverUuid: string; incoming: boolean } | null | false>(false);
  const [joining, setJoining] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [disconnecting, setDisconnecting] = useState<Disconnecting | null>(null);
  const [leaving, setLeaving] = useState(false);

  const doLeave = async () => {
    try {
      await leaveTunnel(server.uuid);
      addToast(t('pages.server.tunnel.toast.left', {}), 'success');
      tunnel.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setLeaving(false);
  };

  const doDisconnect = async ({ peer, incoming }: Disconnecting) => {
    try {
      await deleteTunnelConnection(server.uuid, peer.serverUuid, incoming);
      addToast(t('pages.server.tunnel.toast.disconnected', {}), 'success');
      tunnel.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setDisconnecting(null);
  };

  const data = tunnel.data;
  const nodes = useMemo<CanvasNode[]>(() => {
    if (!data?.tunnel) return [];
    const membership = data.tunnel;

    const selfItems: ContextMenuItem[] = [
      {
        type: 'action',
        icon: faPen,
        label: t('pages.server.tunnel.action.rename', {}),
        onClick: () => setRenaming(true),
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faPlug,
        label: t('pages.server.tunnel.action.editPorts', {}),
        onClick: () => setEditingPorts(true),
        color: 'gray',
        canAccess: canUpdate,
      },
      { type: 'divider', canAccess: canDelete },
      {
        type: 'action',
        icon: faRightFromBracket,
        label: t('pages.server.tunnel.button.leave', {}),
        onClick: () => setLeaving(true),
        color: 'red',
        canAccess: canDelete,
      },
    ];

    const merged = new Map<string, { peer: Peer; outbound: boolean; inbound: boolean }>();
    for (const peer of data.outgoing) {
      merged.set(peer.serverUuid, { peer, outbound: true, inbound: false });
    }
    for (const peer of data.incoming) {
      const existing = merged.get(peer.serverUuid);
      if (existing) existing.inbound = true;
      else merged.set(peer.serverUuid, { peer, outbound: false, inbound: true });
    }

    const edgeOf = (peer: Peer, incoming: boolean, active: boolean): CanvasEdge => ({
      active,
      label: incoming
        ? t('pages.server.tunnel.canvas.legend.inbound', {})
        : t('pages.server.tunnel.canvas.legend.outbound', {}),
      description: t(
        `pages.server.tunnel.canvas.edge.${incoming ? 'inbound' : 'outbound'}${active ? 'Active' : 'Inactive'}`,
        {
          server: peer.serverName,
        },
      ),
      onActivate: active
        ? canDelete
          ? () => setDisconnecting({ peer, incoming })
          : undefined
        : canCreate
          ? () => setConnecting({ serverUuid: peer.serverUuid, incoming })
          : undefined,
    });

    const menuAction = (peer: Peer, incoming: boolean, active: boolean): ContextMenuItem => ({
      type: 'action',
      icon: active ? faTrash : faPlus,
      label: t(`pages.server.tunnel.action.${active ? 'remove' : 'grant'}${incoming ? 'Incoming' : 'Outgoing'}`, {}),
      onClick: () =>
        active ? setDisconnecting({ peer, incoming }) : setConnecting({ serverUuid: peer.serverUuid, incoming }),
      color: active ? 'red' : 'gray',
      canAccess: active ? canDelete : canCreate,
    });

    const peerNode = ({
      peer,
      outbound,
      inbound,
    }: {
      peer: Peer;
      outbound: boolean;
      inbound: boolean;
    }): CanvasNode => ({
      key: peer.serverUuid,
      column: 1,
      edges: { outbound: edgeOf(peer, false, outbound), inbound: edgeOf(peer, true, inbound) },
      render: (measure) => (
        <TunnelNode
          measureRef={measure}
          title={peer.serverName}
          addresses={outbound ? tunnelAddresses(peer.name, peer.alias, peer.address) : []}
          caption={t('pages.server.tunnel.node.caption.peer', {})}
          ports={outbound ? peer.ports : []}
          portsEmpty={outbound ? undefined : t('pages.server.tunnel.node.inboundOnly', {})}
          href={`/server/${peer.serverUuid.slice(0, 8)}`}
          items={[menuAction(peer, false, outbound), menuAction(peer, true, inbound)]}
        />
      ),
    });

    return [
      {
        key: 'self',
        column: 0,
        render: (measure) => (
          <TunnelNode
            self
            measureRef={measure}
            title={server.name}
            addresses={tunnelAddresses(membership.name, membership.alias, membership.address)}
            caption={t('pages.server.tunnel.node.caption.self', {})}
            ports={data.ports}
            items={selfItems}
          />
        ),
      },
      ...[...merged.values()].toSorted((a, b) => a.peer.serverName.localeCompare(b.peer.serverName)).map(peerNode),
    ];
  }, [data, canCreate, canUpdate, canDelete, server, t]);

  const canvasItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        type: 'action',
        icon: faPlus,
        label: t('pages.server.tunnel.button.connect', {}),
        onClick: () => setConnecting(null),
        color: 'gray',
        canAccess: canCreate,
      },
      {
        type: 'action',
        icon: faPlug,
        label: t('pages.server.tunnel.action.editPorts', {}),
        onClick: () => setEditingPorts(true),
        color: 'gray',
        canAccess: canUpdate,
      },
      {
        type: 'action',
        icon: faPen,
        label: t('pages.server.tunnel.action.rename', {}),
        onClick: () => setRenaming(true),
        color: 'gray',
        canAccess: canUpdate,
      },
    ],
    [canCreate, canUpdate, t],
  );

  return (
    <ResourceView resource={tunnel}>
      {(view) => (
        <ServerContentContainer
          title={t('pages.server.tunnel.title', {})}
          subtitle={t('pages.server.tunnel.subtitle', {})}
          contentRight={
            view.tunnel && (
              <Group gap='xs'>
                <ServerCan action='connections.update'>
                  <Button
                    variant='default'
                    leftSection={<FontAwesomeIcon icon={faPlug} />}
                    onClick={() => setEditingPorts(true)}
                  >
                    {t('pages.server.tunnel.button.editPorts', {})}
                  </Button>
                </ServerCan>
                <ServerCan action='connections.create'>
                  <ConditionalTooltip
                    enabled={view.outgoing.length >= maxConnections}
                    label={t('pages.server.tunnel.tooltip.connectionLimitReached', { max: maxConnections })}
                  >
                    <Button
                      disabled={view.outgoing.length >= maxConnections}
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      onClick={() => setConnecting(null)}
                    >
                      {t('pages.server.tunnel.button.connect', {})}
                    </Button>
                  </ConditionalTooltip>
                </ServerCan>
              </Group>
            )
          }
        >
          <JoinTunnelModal opened={joining} onClose={() => setJoining(false)} onJoined={() => tunnel.invalidate()} />

          {view.tunnel && (
            <ConnectServerModal
              opened={connecting !== false}
              initial={connecting || null}
              tunnel={view}
              onClose={() => setConnecting(false)}
              onCreated={() => tunnel.invalidate()}
            />
          )}

          {view.tunnel && (
            <>
              <RenameTunnelModal
                opened={renaming}
                onClose={() => setRenaming(false)}
                name={view.tunnel.name}
                alias={view.tunnel.alias}
                onRenamed={() => tunnel.invalidate()}
              />

              <TunnelPortsModal
                opened={editingPorts}
                onClose={() => setEditingPorts(false)}
                ports={view.ports.map((port) => ({ port: port.port, protocols: port.protocols }))}
                allocationPorts={view.allocationPorts}
                onSaved={() => tunnel.invalidate()}
              />
            </>
          )}

          <ConfirmationModal
            opened={disconnecting !== null}
            onClose={() => setDisconnecting(null)}
            title={t('pages.server.tunnel.modal.disconnect.title', {})}
            confirm={t('common.button.remove', {})}
            onConfirmed={() => {
              if (disconnecting) {
                return doDisconnect(disconnecting);
              }
            }}
          >
            {(disconnecting?.incoming
              ? t('pages.server.tunnel.modal.disconnect.contentIncoming', {
                  server: disconnecting?.peer.serverName ?? '',
                })
              : t('pages.server.tunnel.modal.disconnect.content', {
                  server: disconnecting?.peer.serverName ?? '',
                })
            ).md()}
          </ConfirmationModal>

          <ConfirmationModal
            opened={leaving}
            onClose={() => setLeaving(false)}
            title={t('pages.server.tunnel.modal.leave.title', {})}
            confirm={t('pages.server.tunnel.button.leave', {})}
            onConfirmed={doLeave}
          >
            {t('pages.server.tunnel.modal.leave.content', {}).md()}
          </ConfirmationModal>

          <NetworkSubNavigation />

          <Stack>
            {!view.supported && (
              <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {(view.tunnel
                  ? t('pages.server.tunnel.alert.nodeLeftNetwork', {})
                  : t('pages.server.tunnel.alert.nodeNotOnNetwork', {})
                ).md()}
              </Alert>
            )}

            {!view.tunnel ? (
              <Paper withBorder p='xl' radius='md' style={{ textAlign: 'center' }}>
                <ThemeIcon size='xl' mb='md' color='gray'>
                  <FontAwesomeIcon icon={faShareNodes} />
                </ThemeIcon>
                <Title order={3} c='dimmed' mb='sm'>
                  {t('pages.server.tunnel.empty.title', {})}
                </Title>
                <Text c='dimmed' mb='md'>
                  {canCreate
                    ? t('pages.server.tunnel.empty.description', {})
                    : t('pages.server.tunnel.empty.descriptionReadOnly', {})}
                </Text>
                <ServerCan action='connections.create'>
                  <ConditionalTooltip
                    enabled={!view.supported}
                    label={t('pages.server.tunnel.tooltip.nodeNotOnNetwork', {})}
                  >
                    <Button
                      disabled={!view.supported}
                      onClick={() => setJoining(true)}
                      leftSection={<FontAwesomeIcon icon={faRightToBracket} />}
                    >
                      {t('pages.server.tunnel.button.join', {})}
                    </Button>
                  </ConditionalTooltip>
                </ServerCan>
              </Paper>
            ) : (
              <>
                <Alert color='gray'>{t('pages.server.tunnel.alert.bypassesFirewall', {})}</Alert>

                <TunnelCanvas
                  nodes={nodes}
                  items={canvasItems}
                  hint={
                    view.outgoing.length === 0 && view.incoming.length === 0
                      ? canCreate && t('pages.server.tunnel.outgoing.empty', {})
                      : t('pages.server.tunnel.canvas.hint', {})
                  }
                  onPan={hideContextMenu}
                />
              </>
            )}
          </Stack>
        </ServerContentContainer>
      )}
    </ResourceView>
  );
}

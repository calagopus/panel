import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getServer from '@/api/server/getServer.ts';
import createTunnelConnection from '@/api/server/tunnel/createTunnelConnection.ts';
import getAvailableTunnelServers from '@/api/server/tunnel/getAvailableTunnelServers.ts';
import getTunnel from '@/api/server/tunnel/getTunnel.ts';
import updateTunnelPorts from '@/api/server/tunnel/updateTunnelPorts.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { serverTunnelSchema } from '@/lib/schemas/server/tunnel.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useServerCanFor } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import DirectionRow from '../DirectionRow.tsx';

type Server = z.infer<typeof serverSchema>;
type Tunnel = z.infer<typeof serverTunnelSchema>;

const DEFAULT_PORT = 25565;

function addressesFor(name: string, ports: { port: number }[]): string[] {
  return name ? ports.map((port) => `${name}.tunnel:${port.port}`) : [];
}

type Props = ModalProps & {
  initial?: { serverUuid: string; incoming: boolean } | null;
  tunnel: Tunnel;
  onCreated: () => void;
};

export default function ConnectServerModal({ initial, tunnel, onCreated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const maxConnections = useGlobalStore((state) => state.settings.server.maxTunnelConnectionCount);

  const [selected, setSelected] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [outbound, setOutbound] = useState(true);
  const [inbound, setInbound] = useState(false);
  const [newPort, setNewPort] = useState<number>(DEFAULT_PORT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) return;

    setSelected(initial?.serverUuid ?? null);
    setSelectedServer(null);
    setOutbound(initial ? !initial.incoming : true);
    setInbound(initial ? initial.incoming : false);
    setNewPort(DEFAULT_PORT);
  }, [props.opened, initial]);

  // the peer's own tunnel view carries its hostname, offered ports and allocations in one
  // request; it is silent because a user without connections.read there just loses the preview
  const peer = useResource({
    queryKey: queryKeys.server(selected ?? '').tunnel.all(),
    queryFn: () => getTunnel(selected ?? ''),
    enabled: props.opened && !!selected,
    silent: true,
  });

  // opening from a canvas edge only yields a uuid, and the peer lists carry no permissions, so
  // the gates below would silently pass and turn into a raw 403 on submit
  const peerServerQuery = useResource({
    queryKey: queryKeys.server(selected ?? '').detail(),
    queryFn: () => getServer(selected ?? ''),
    enabled: props.opened && !!selected && !selectedServer,
    silent: true,
  });
  const peerServer = selectedServer ?? peerServerQuery.data ?? null;

  const peerPorts = peer.data?.ports ?? [];
  const peerName =
    peerServer?.name ??
    [...tunnel.outgoing, ...tunnel.incoming].find((item) => item.serverUuid === selected)?.serverName ??
    '';

  const canEditPeerPorts = useServerCanFor(peerServer?.permissions, 'connections.update');
  // either direction is a grant on the peer, so both need connections.create there
  const canConnectPeer = useServerCanFor(peerServer?.permissions, 'connections.create');
  const peerBlocked = peerServer && !canConnectPeer;

  const alreadyOutbound = tunnel.outgoing.some((item) => item.serverUuid === selected);
  const alreadyInbound = tunnel.incoming.some((item) => item.serverUuid === selected);

  const outboundCollision = peerPorts.find((port) => tunnel.allocationPorts.includes(port.port));
  const inboundCollision = tunnel.ports.find((port) => peer.data?.allocationPorts.includes(port.port));
  const atLimit = tunnel.outgoing.length >= maxConnections;

  const outboundBlocked = !selected
    ? undefined
    : alreadyOutbound
      ? t('pages.server.tunnel.modal.connect.alreadyOn', {})
      : outboundCollision
        ? t('pages.server.tunnel.modal.connect.collision', {
            port: String(outboundCollision.port),
            server: peerName,
          })
        : atLimit
          ? t('pages.server.tunnel.tooltip.connectionLimitReached', { max: maxConnections })
          : peerBlocked
            ? t('pages.server.tunnel.modal.connect.noPermissionTo', { server: peerName })
            : undefined;

  const inboundBlocked = !selected
    ? undefined
    : alreadyInbound
      ? t('pages.server.tunnel.modal.connect.alreadyOn', {})
      : inboundCollision
        ? t('pages.server.tunnel.modal.connect.collisionReverse', {
            port: String(inboundCollision.port),
            server: peerName,
          })
        : peerBlocked
          ? t('pages.server.tunnel.modal.connect.noPermission', { server: peerName })
          : undefined;

  const doAddPort = async () => {
    if (!selected) return;

    setLoading(true);

    try {
      await updateTunnelPorts(selected, {
        ports: [
          ...peerPorts.map(({ port, protocols }) => ({ port, protocols })),
          { port: newPort, protocols: ['tcp'] },
        ],
      });
      addToast(t('pages.server.tunnel.toast.portsSaved', {}), 'success');
      peer.invalidate();
      onCreated();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setLoading(false);
  };

  const doConnect = async () => {
    if (!selected) return;

    setLoading(true);
    let granted = false;

    if (outbound && !outboundBlocked) {
      try {
        await createTunnelConnection(server.uuid, { server: selected });
        granted = true;
      } catch (error) {
        addToast(httpErrorToHuman(error), 'error');
      }
    }

    if (inbound && !inboundBlocked) {
      try {
        await createTunnelConnection(selected, { server: server.uuid });
        granted = true;
      } catch (error) {
        addToast(httpErrorToHuman(error), 'error');
      }
    }

    if (granted) {
      addToast(t('pages.server.tunnel.toast.connected', {}), 'success');
      onCreated();
      props.onClose();
    }

    setLoading(false);
  };

  const offersNothing = Boolean(peer.data) && peerPorts.length === 0;

  return (
    <Modal title={t('pages.server.tunnel.modal.connect.title', {})} {...props}>
      <Stack gap='md'>
        <ServerSelect<Server>
          label={t('pages.server.tunnel.form.server', {})}
          description={t('pages.server.tunnel.form.serverDescription', {})}
          nothingFoundMessage={t('pages.server.tunnel.modal.connect.empty', {})}
          withOthersSwitch
          queryKey={queryKeys.server(server.uuid).tunnel.available()}
          fetcher={(search, showOthers) => getAvailableTunnelServers(server.uuid, 1, search, showOthers)}
          value={selected}
          selectedItem={selectedServer}
          onChange={(uuid, item) => {
            setSelected(uuid);
            setSelectedServer(item);
          }}
        />

        {selected && (
          <Stack gap={0}>
            <DirectionRow
              incoming={false}
              label={t('pages.server.tunnel.modal.connect.outbound', { server: peerName })}
              checked={outbound || alreadyOutbound}
              onChange={alreadyOutbound ? undefined : setOutbound}
              blocked={outboundBlocked}
              addresses={addressesFor(peer.data?.tunnel?.name ?? '', peerPorts)}
              empty={t('pages.server.tunnel.modal.connect.offersNothing', { server: peerName })}
            >
              {offersNothing && !outboundBlocked && (
                <Group gap='xs' className='mt-1'>
                  <NumberInput
                    min={1}
                    max={65535}
                    size='xs'
                    className='w-24'
                    value={newPort}
                    onChange={(value) => setNewPort(Number(value))}
                    disabled={!canEditPeerPorts}
                  />
                  <Button
                    size='xs'
                    variant='default'
                    loading={loading}
                    disabled={!canEditPeerPorts}
                    leftSection={<FontAwesomeIcon icon={faPlus} />}
                    onClick={doAddPort}
                  >
                    {t('pages.server.tunnel.modal.connect.addPortTo', { server: peerName })}
                  </Button>
                </Group>
              )}
            </DirectionRow>

            <DirectionRow
              incoming
              label={t('pages.server.tunnel.modal.connect.inbound', { server: peerName })}
              checked={inbound || alreadyInbound}
              onChange={alreadyInbound ? undefined : setInbound}
              blocked={inboundBlocked}
              addresses={addressesFor(tunnel.tunnel?.name ?? '', tunnel.ports)}
              empty={t('pages.server.tunnel.modal.connect.youOfferNothing', {})}
            />
          </Stack>
        )}

        {selected && offersNothing && !canEditPeerPorts && (
          <Alert color='yellow'>
            {t('pages.server.tunnel.modal.connect.offersNothingAlert', { server: peerName }).md()}
          </Alert>
        )}
      </Stack>

      <ModalFooter>
        <Button
          loading={loading}
          disabled={!selected || (!(outbound && !outboundBlocked) && !(inbound && !inboundBlocked))}
          onClick={doConnect}
        >
          {t('pages.server.tunnel.button.connect', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

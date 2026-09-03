import {
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faExclamationTriangle,
  faShareNodes,
  faSignal,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SimpleGrid } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createNodeTunnel from '@/api/admin/nodes/tunnel/createNodeTunnel.ts';
import deleteNodeTunnel from '@/api/admin/nodes/tunnel/deleteNodeTunnel.ts';
import getNodeTunnel from '@/api/admin/nodes/tunnel/getNodeTunnel.ts';
import rotateNodeTunnel from '@/api/admin/nodes/tunnel/rotateNodeTunnel.ts';
import updateNodeTunnel from '@/api/admin/nodes/tunnel/updateNodeTunnel.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import InfoRow from '@/elements/admin/InfoRow.tsx';
import Button from '@/elements/buttons/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Text from '@/elements/typography/Text.tsx';
import { NODE_TUNNEL_DEFAULT_PORT } from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminNodeTunnelMetrics from './AdminNodeTunnelMetrics.tsx';

export default function AdminNodeTunnel({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const tunnel = useResource({
    queryKey: queryKeys.admin.nodes.tunnel(node.uuid),
    queryFn: () => getNodeTunnel(node.uuid),
  });

  const [host, setHost] = useState('');
  const [port, setPort] = useState(NODE_TUNNEL_DEFAULT_PORT);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    if (!tunnel.data) return;

    setHost(tunnel.data.tunnel?.host ?? new URL(node.url).hostname);
    setPort(tunnel.data.tunnel?.port ?? NODE_TUNNEL_DEFAULT_PORT);
  }, [tunnel.data]);

  const doSave = async (alreadyOnNetwork: boolean) => {
    setSaving(true);

    try {
      if (alreadyOnNetwork) {
        await updateNodeTunnel(node.uuid, { host, port });
        addToast(t('pages.admin.nodes.tabs.tunnel.page.toast.updated', {}), 'success');
      } else {
        await createNodeTunnel(node.uuid, { host, port });
        addToast(t('pages.admin.nodes.tabs.tunnel.page.toast.enabled', {}), 'success');
      }

      tunnel.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setSaving(false);
  };

  const doDisable = async () => {
    setSaving(true);

    try {
      await deleteNodeTunnel(node.uuid);
      addToast(t('pages.admin.nodes.tabs.tunnel.page.toast.disabled', {}), 'success');
      tunnel.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setDisabling(false);
    setSaving(false);
  };

  const doRotate = async () => {
    setSaving(true);

    try {
      await rotateNodeTunnel(node.uuid);
      addToast(t('pages.admin.nodes.tabs.tunnel.page.toast.rotated', {}), 'success');
      tunnel.invalidate();
    } catch (error) {
      addToast(httpErrorToHuman(error), 'error');
    }

    setRotating(false);
    setSaving(false);
  };

  return (
    <ResourceView resource={tunnel}>
      {(data) => (
        <AdminSubContentContainer title={t('pages.admin.nodes.tabs.tunnel.page.title', {})} titleOrder={2}>
          <ConfirmationModal
            opened={disabling}
            onClose={() => setDisabling(false)}
            title={t('pages.admin.nodes.tabs.tunnel.page.modal.disable.title', {})}
            confirm={t('pages.admin.nodes.tabs.tunnel.page.button.disable', {})}
            onConfirmed={doDisable}
          >
            {t('pages.admin.nodes.tabs.tunnel.page.modal.disable.content', {}).md()}
          </ConfirmationModal>

          <ConfirmationModal
            opened={rotating}
            onClose={() => setRotating(false)}
            title={t('pages.admin.nodes.tabs.tunnel.page.modal.rotate.title', {})}
            confirm={t('pages.admin.nodes.tabs.tunnel.page.button.rotate', {})}
            onConfirmed={doRotate}
          >
            {t('pages.admin.nodes.tabs.tunnel.page.modal.rotate.content', {}).md()}
          </ConfirmationModal>

          <Stack>
            {data.status === null ? (
              <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.admin.nodes.tabs.tunnel.page.alert.unreachable', {}).md()}
              </Alert>
            ) : (
              !data.status.supported && (
                <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                  {t('pages.admin.nodes.tabs.tunnel.page.alert.notSupported', {}).md()}
                </Alert>
              )
            )}

            {data.tunnel && !data.tunnel.certSha256 && (
              <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.admin.nodes.tabs.tunnel.page.alert.noCertificate', {}).md()}
              </Alert>
            )}

            <TitleCard
              title={t('pages.admin.nodes.tabs.tunnel.page.section.settings', {})}
              icon={<FontAwesomeIcon icon={faShareNodes} />}
            >
              <Stack gap='md'>
                <Text c='dimmed' size='sm'>
                  {t('pages.admin.nodes.tabs.tunnel.page.description', {}).md()}
                </Text>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
                  <TextInput
                    label={t('pages.admin.nodes.tabs.tunnel.page.form.host', {})}
                    description={t('pages.admin.nodes.tabs.tunnel.page.form.hostDescription', {})}
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                  />

                  <NumberInput
                    min={1}
                    max={65535}
                    label={t('pages.admin.nodes.tabs.tunnel.page.form.port', {})}
                    description={t('pages.admin.nodes.tabs.tunnel.page.form.portDescription', {})}
                    value={port}
                    onChange={(value) => setPort(Number(value))}
                  />
                </SimpleGrid>

                <Group justify='space-between'>
                  <Button loading={saving} onClick={() => doSave(data.tunnel !== null)}>
                    {data.tunnel
                      ? t('common.button.save', {})
                      : t('pages.admin.nodes.tabs.tunnel.page.button.enable', {})}
                  </Button>

                  {data.tunnel && (
                    <Group gap='sm'>
                      <Button variant='default' loading={saving} onClick={() => setRotating(true)}>
                        {t('pages.admin.nodes.tabs.tunnel.page.button.rotate', {})}
                      </Button>
                      <Button color='red' loading={saving} onClick={() => setDisabling(true)}>
                        {t('pages.admin.nodes.tabs.tunnel.page.button.disable', {})}
                      </Button>
                    </Group>
                  )}
                </Group>
              </Stack>
            </TitleCard>

            {data.tunnel && (
              <TitleCard
                title={t('pages.admin.nodes.tabs.tunnel.page.state.title', {})}
                icon={<FontAwesomeIcon icon={faSignal} />}
              >
                <Stack gap={0}>
                  <InfoRow label={t('pages.admin.nodes.tabs.tunnel.page.state.daemon', {})}>
                    {data.status === null ? (
                      <Badge color='gray'>
                        <FontAwesomeIcon icon={faCircleQuestion} />{' '}
                        {t('pages.admin.nodes.tabs.tunnel.page.state.unknown', {})}
                      </Badge>
                    ) : (
                      <Badge color={data.status.connected ? 'green' : 'red'}>
                        <FontAwesomeIcon icon={data.status.connected ? faCircleCheck : faCircleXmark} />{' '}
                        {data.status.connected
                          ? t('pages.admin.nodes.tabs.tunnel.page.state.connected', {})
                          : t('pages.admin.nodes.tabs.tunnel.page.state.disconnected', {})}
                      </Badge>
                    )}
                  </InfoRow>

                  {data.status?.epoch != null && (
                    <InfoRow label={t('pages.admin.nodes.tabs.tunnel.page.state.epoch', {})}>
                      {data.status.epoch}
                    </InfoRow>
                  )}

                  <InfoRow label={t('pages.admin.nodes.tabs.tunnel.page.state.certificate', {})}>
                    {data.tunnel.certSha256 ? (
                      <CopyOnClick content={data.tunnel.certSha256}>
                        <Text size='sm' ff='monospace' style={{ wordBreak: 'break-all' }}>
                          {data.tunnel.certSha256}
                        </Text>
                      </CopyOnClick>
                    ) : (
                      <Text size='sm' c='red'>
                        {t('pages.admin.nodes.tabs.tunnel.page.state.noCertificate', {})}
                      </Text>
                    )}
                  </InfoRow>
                </Stack>
              </TitleCard>
            )}

            {data.tunnel && <AdminNodeTunnelMetrics nodeUuid={node.uuid} />}
          </Stack>
        </AdminSubContentContainer>
      )}
    </ResourceView>
  );
}

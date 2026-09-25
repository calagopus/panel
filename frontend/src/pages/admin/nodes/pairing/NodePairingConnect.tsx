import { faCheck, faExclamationTriangle, faPlug, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text } from '@mantine/core';
import { useState } from 'react';
import probeNode from '@/api/admin/nodes/probeNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import UrlMissingPortAlert from '@/elements/UrlMissingPortAlert.tsx';
import { WINGS_DEFAULT_PORT } from '@/lib/domain/node.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { getUrlConnectPort, withUrlPort } from '@/lib/network/url.ts';
import { AdminNodeSetupProbe } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface NodePairingTarget {
  url: string;
  pairingCode: string;
  probe: AdminNodeSetupProbe;
}

export default function NodePairingConnect({
  target,
  onConnected,
  onReset,
}: {
  target: NodePairingTarget | null;
  onConnected: (target: NodePairingTarget) => void;
  onReset: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [url, setUrl] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);

  const doConnect = () => {
    setLoading(true);

    probeNode(url, pairingCode)
      .then((probe) => onConnected({ url, pairingCode, probe }))
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  };

  if (target) {
    const { probe } = target;

    return (
      <TitleCard
        title={t('pages.admin.nodes.pairing.probe.title', { version: probe.version })}
        icon={<FontAwesomeIcon icon={faServer} />}
        rightSection={
          <Button variant='default' size='xs' ml='auto' onClick={onReset}>
            {t('pages.admin.nodes.pairing.button.change', {})}
          </Button>
        }
      >
        <Stack gap={4}>
          <Text size='sm' c='dimmed'>
            {target.url}
          </Text>
          <Text size='sm'>
            {t('pages.admin.nodes.pairing.probe.resources', {
              cores: String(probe.cpuCount),
              memory: bytesToString(probe.memoryBytes),
              disk: bytesToString(probe.diskBytes),
              architecture: probe.architecture,
            })}
          </Text>
        </Stack>

        <Stack gap='xs' mt='md'>
          {probe.docker.available ? (
            <Alert color='green' icon={<FontAwesomeIcon icon={faCheck} />}>
              {t('pages.admin.nodes.pairing.probe.dockerAvailable', { version: probe.docker.version ?? '' })}
            </Alert>
          ) : (
            <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
              {t('pages.admin.nodes.pairing.probe.dockerUnavailable', {})}
            </Alert>
          )}
          {probe.container && <Alert color='blue'>{t('pages.admin.nodes.pairing.probe.container', {})}</Alert>}
        </Stack>
      </TitleCard>
    );
  }

  return (
    <TitleCard title={t('pages.admin.nodes.pairing.title', {})} icon={<FontAwesomeIcon icon={faPlug} />}>
      <Text size='sm' c='dimmed' mb='sm'>
        {t('pages.admin.nodes.pairing.description', {}).md()}
      </Text>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          doConnect();
        }}
      >
        <Stack gap='md'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='flex flex-col gap-2'>
              <TextInput
                withAsterisk
                label={t('pages.admin.nodes.pairing.form.address', {})}
                description={t('pages.admin.nodes.pairing.form.addressDescription', {})}
                placeholder='http://203.0.113.10:8080'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <UrlMissingPortAlert
                url={url}
                defaultPort={WINGS_DEFAULT_PORT}
                onAddPort={() => setUrl(withUrlPort(url, WINGS_DEFAULT_PORT))}
              >
                {t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
                  port: String(getUrlConnectPort(url) ?? 443),
                  wingsPort: String(WINGS_DEFAULT_PORT),
                }).md()}
              </UrlMissingPortAlert>
            </div>
            <TextInput
              withAsterisk
              label={t('pages.admin.nodes.pairing.form.pairingCode', {})}
              description={t('pages.admin.nodes.pairing.form.pairingCodeDescription', {})}
              placeholder='ABCD-EFGH'
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
            />
          </div>

          <Group>
            <Button
              type='submit'
              loading={loading}
              disabled={!url.trim() || !pairingCode.trim()}
              leftSection={<FontAwesomeIcon icon={faPlug} />}
            >
              {t('pages.admin.nodes.pairing.button.connect', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </TitleCard>
  );
}

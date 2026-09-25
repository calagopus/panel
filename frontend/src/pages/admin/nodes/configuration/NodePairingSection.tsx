import { faCopy, faLink, faPlug, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import createNodeEnrollment from '@/api/admin/nodes/createNodeEnrollment.ts';
import pairNode from '@/api/admin/nodes/pairNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import { handleCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { getNodeEnrollmentCommand } from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useNodeOnlineWait } from '@/plugins/nodes/useNodeOnlineWait.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodePairingStatusAlert from './NodePairingStatusAlert.tsx';

const PAIR_TIMEOUT_MS = 90_000;
const ENROLLMENT_TIMEOUT_MS = 30 * 60_000;

export default function NodePairingSection({ node, onConnected }: { node: AdminNode; onConnected?: () => void }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const onlineWait = useNodeOnlineWait();

  const [pairingCode, setPairingCode] = useState('');
  const [remote, setRemote] = useState('');
  const [pairing, setPairing] = useState(false);
  const [enrollmentCommand, setEnrollmentCommand] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const remoteOverride = remote.trim() || null;

  useEffect(() => {
    if (onlineWait.status !== 'connected') return;

    queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.token(node.uuid) }).then(() => onConnected?.());
  }, [onlineWait.status]);

  const doPair = () => {
    setPairing(true);

    pairNode(node.uuid, pairingCode, remoteOverride)
      .then(() => {
        setPairingCode('');
        onlineWait.start(node.uuid, PAIR_TIMEOUT_MS);
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setPairing(false));
  };

  const doGenerate = () => {
    setGenerating(true);

    createNodeEnrollment(node.uuid, remoteOverride)
      .then(({ code }) => {
        setEnrollmentCommand(getNodeEnrollmentCommand(remoteOverride ?? window.location.origin, code));
        onlineWait.start(node.uuid, ENROLLMENT_TIMEOUT_MS);
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setGenerating(false));
  };

  return (
    <TitleCard title={t('pages.admin.nodes.pairing.title', {})} icon={<FontAwesomeIcon icon={faPlug} />}>
      <Text size='sm' c='dimmed' mb='sm'>
        {t('pages.admin.nodes.pairing.description', {}).md()}
      </Text>

      <Stack gap='md'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            label={t('pages.admin.nodes.pairing.form.pairingCode', {})}
            description={t('pages.admin.nodes.pairing.form.pairingCodeDescription', {})}
            placeholder='ABCD-EFGH'
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value)}
          />
          <TextInput
            label={t('pages.admin.nodes.pairing.form.panelUrl', {})}
            description={t('pages.admin.nodes.pairing.form.panelUrlDescription', {})}
            placeholder={window.location.origin}
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
          />
        </div>

        <Group>
          <Button
            onClick={doPair}
            loading={pairing}
            disabled={!pairingCode.trim()}
            leftSection={<FontAwesomeIcon icon={faLink} />}
          >
            {t('pages.admin.nodes.pairing.button.pair', {})}
          </Button>
          <Button
            variant='default'
            onClick={doGenerate}
            loading={generating}
            leftSection={<FontAwesomeIcon icon={faTerminal} />}
          >
            {t('pages.admin.nodes.pairing.button.generateCommand', {})}
          </Button>
        </Group>

        {enrollmentCommand && (
          <div className='min-w-0'>
            <Text size='sm' mb='xs'>
              {t('pages.admin.nodes.pairing.enrollment.description', {}).md()}
            </Text>
            <Group gap='xs' align='flex-start' wrap='nowrap'>
              <Code block className='flex-1 min-w-0 overflow-x-auto'>
                {enrollmentCommand}
              </Code>
              <Tooltip label={t('pages.admin.nodes.tabs.configuration.page.tooltip.copyCommand', {})}>
                <ActionIcon variant='subtle' onClick={handleCopyToClipboard(enrollmentCommand, addToast)} size='lg'>
                  <FontAwesomeIcon icon={faCopy} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </div>
        )}

        <NodePairingStatusAlert status={onlineWait.status} version={onlineWait.version} />
      </Stack>
    </TitleCard>
  );
}

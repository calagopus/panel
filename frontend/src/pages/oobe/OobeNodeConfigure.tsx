import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Title } from '@mantine/core';
import jsYaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import { getNodeConfiguration, getNodeConfigurationCommand, getNodeUrl } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeNodeConfigure({ onNext, skipFrom }: OobeComponentProps) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [node, setNode] = useState<z.infer<typeof adminNodeSchema> | null>(null);
  const [nodeConfiguration, setNodeConfiguration] = useState({});
  const [command, setCommand] = useState('');

  useEffect(() => {
    getNodes(1)
      .then((nodes) => {
        if (nodes.total > 0) {
          setNode(nodes.data[0]);
          setLoading(false);
        } else {
          setError(t('pages.oobe.nodeConfiguration.error.noNodes', {}));
        }
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      });
  }, []);

  useEffect(() => {
    if (!node) return;

    const remote = window.location.origin;
    const apiPort = parseInt(new URL(node.url).port || '8080');
    const sftpPort = node.sftpPort;

    setNodeConfiguration(getNodeConfiguration({ node, remote, apiPort, sftpPort }));
    setCommand(getNodeConfigurationCommand({ node, remote, apiPort, sftpPort }));
  }, [node]);

  const verifyNode = async () => {
    if (!node) return;

    setLoading(true);
    setIsVerified(false);

    axiosInstance
      .get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${node.token}`,
        },
      })
      .then(({ data }) => {
        if (data.version) {
          setIsVerified(true);
          setError('');
        }
      })
      .catch((msg) => {
        console.error('Error while connecting to node', msg);
        setError(t('pages.oobe.nodeConfiguration.error.connectionError', {}));
      })
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.nodeConfiguration.title', {})}</Title>

      <div className='max-w-2xl flex flex-col gap-4 self-end'>
        {error && <AlertError error={error} setError={setError} />}
        {isVerified && !error && (
          <Alert icon={<FontAwesomeIcon icon={faCheck} />} color='green' title={t('common.alert.success', {})}>
            {t('pages.oobe.nodeConfiguration.successMessage', {})}
          </Alert>
        )}

        <div className='flex flex-col min-w-0'>
          <HljsCode
            languageName='yaml'
            language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
          >
            {jsYaml.dump(nodeConfiguration)}
          </HljsCode>

          <div className='mt-2'>
            {t('pages.oobe.nodeConfiguration.configurationDescription', { file: '/etc/pterodactyl/config.yml' }).md()}
            <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
              <Code block className='flex-1 overflow-x-auto'>
                {command}
              </Code>
              <ActionIcon variant='subtle' onClick={handleCopyToClipboard(command, addToast)} size='lg'>
                <FontAwesomeIcon icon={faCopy} />
              </ActionIcon>
            </Group>
          </div>
        </div>

        <Button loading={loading} leftSection={<FontAwesomeIcon icon={faCheck} />} onClick={() => verifyNode()}>
          {t('pages.oobe.nodeConfiguration.button.verify', {})}
        </Button>
      </div>

      <Group justify='flex-end'>
        {!!skipFrom && (
          <Button variant='outline' onClick={() => skipFrom('node')}>
            {t('common.button.skip', {})}
          </Button>
        )}
        <Button disabled={!isVerified} loading={loading} onClick={() => onNext()}>
          {t('common.button.continue', {})}
        </Button>
      </Group>
    </Stack>
  );
}

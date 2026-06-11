import { faCheck, faChevronLeft, faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Title } from '@mantine/core';
import jsYaml from 'js-yaml';
import { useCallback, useEffect, useMemo, useState } from 'react';
import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import { axiosInstance } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import { getNodeConfiguration, getNodeConfigurationCommand, getNodeUrl } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeNodeConfigure({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const node = data.nodes[0] ?? null;
  const { data: nodeToken } = useResource({
    queryKey: queryKeys.admin.nodes.token(node?.uuid ?? ''),
    queryFn: useCallback(() => getNodeToken(node!.uuid), [node]),
    enabled: !!node,
  });

  useEffect(() => {
    if (!node) {
      setError(t('pages.oobe.nodeConfiguration.error.noNodes', {}));
    }
  }, [node, t]);

  const configurationParams = useMemo(() => {
    if (!node || !nodeToken) {
      return null;
    }

    return {
      node,
      token: nodeToken,
      remote: window.location.origin,
      apiPort: parseInt(new URL(node.url).port || '8080'),
      sftpPort: node.sftpPort,
    };
  }, [node, nodeToken]);

  const nodeConfiguration = useMemo(
    () => (configurationParams ? getNodeConfiguration(configurationParams) : null),
    [configurationParams],
  );
  const command = useMemo(
    () => (configurationParams ? getNodeConfigurationCommand(configurationParams) : null),
    [configurationParams],
  );

  const verifyNode = async () => {
    if (!node || !nodeToken) return;

    setLoading(true);
    setIsVerified(false);

    axiosInstance
      .get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${nodeToken.token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
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

      <div className='w-full sm:max-w-2xl flex flex-col gap-4 sm:self-end'>
        {error && <AlertError error={error} setError={setError} />}
        {isVerified && !error && (
          <Alert icon={<FontAwesomeIcon icon={faCheck} />} color='green' title={t('common.alert.success', {})}>
            {t('pages.oobe.nodeConfiguration.successMessage', {})}
          </Alert>
        )}

        {node && nodeConfiguration && command && (
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
        )}

        {node && (
          <Button loading={loading} leftSection={<FontAwesomeIcon icon={faCheck} />} onClick={() => verifyNode()}>
            {t('pages.oobe.nodeConfiguration.button.verify', {})}
          </Button>
        )}
      </div>

      <Group justify='flex-end'>
        {canGoBack && (
          <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
            Back
          </Button>
        )}
        <Button variant='outline' onClick={() => skipFrom('nodeconfiguration')}>
          {t('common.button.skip', {})}
        </Button>
        <Button disabled={!isVerified} loading={loading} onClick={() => onNext()}>
          {t('common.button.continue', {})}
        </Button>
      </Group>
    </Stack>
  );
}

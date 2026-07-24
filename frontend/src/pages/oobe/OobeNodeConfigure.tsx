import { faCheck, faChevronLeft, faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dump } from 'js-yaml';
import { useCallback, useEffect, useMemo, useState } from 'react';
import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import { axiosInstance } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Group from '@/elements/Group.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import {
  getNodeConfiguration,
  getNodeConfigurationCommand,
  getNodeConnectPort,
  getNodeDefaultApiPort,
  getNodeUrl,
  isNodeAIO,
} from '@/lib/node.ts';
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
      apiPort: getNodeDefaultApiPort(node),
      sftpPort: node.sftpPort,
    };
  }, [node, nodeToken]);

  const connectPort = node ? getNodeConnectPort(node) : null;
  const apiPort = node ? getNodeDefaultApiPort(node) : null;
  const portMismatch = !!node && !isNodeAIO(node) && connectPort !== null && connectPort !== apiPort;

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

    const [backend, frontend] = await Promise.allSettled([
      getNodeSystemOverview(node.uuid),
      axiosInstance.get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${nodeToken.token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }),
    ]);

    if (backend.status === 'rejected') {
      console.error('Error while connecting to node from the panel', backend.reason);
      setError(t('pages.oobe.nodeConfiguration.error.connectionError', {}));
    } else if (frontend.status === 'rejected' || !frontend.value.data.version) {
      console.error(
        'Error while connecting to node from the browser',
        frontend.status === 'rejected' ? frontend.reason : frontend.value,
      );
      setError(t('pages.oobe.nodeConfiguration.error.frontendConnectionError', {}));
    } else {
      setIsVerified(true);
      setError('');
    }

    setLoading(false);
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
        {portMismatch && (
          <Alert icon={<FontAwesomeIcon icon={faExclamationTriangle} />} color='yellow'>
            {t('pages.admin.nodes.tabs.configuration.page.alert.portMismatch', {
              connectPort: String(connectPort),
              apiPort: String(apiPort),
            }).md()}
          </Alert>
        )}

        {node && nodeConfiguration && command && (
          <div className='flex flex-col min-w-0'>
            <HljsCode
              languageName='yaml'
              language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
            >
              {dump(nodeConfiguration)}
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
          <Button
            loading={loading}
            disabled={!nodeToken}
            leftSection={<FontAwesomeIcon icon={faCheck} />}
            onClick={() => verifyNode()}
          >
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

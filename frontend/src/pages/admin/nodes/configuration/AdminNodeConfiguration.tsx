import { faCheck, faCircleQuestion, faCopy, faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text } from '@mantine/core';
import { dump, load } from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeConfig from '@/api/admin/nodes/getNodeConfig.ts';
import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import updateNodeConfig from '@/api/admin/nodes/updateNodeConfig.ts';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import {
  getNodeConfiguration,
  getNodeConfigurationCommand,
  getNodeConnectPort,
  getNodeDefaultApiPort,
  getNodeUrl,
  isNodeAIO,
  WINGS_DEFAULT_PORT,
} from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { urlIsMissingPort } from '@/lib/url.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type VerifyResult = { ok: true; version: string } | { ok: false; error: string };

function VerifyStatusAlert({
  title,
  result,
  renderError,
}: {
  title: string;
  result: VerifyResult | null;
  renderError: (error: string) => React.ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <Alert
      color={result ? (result.ok ? 'green' : 'red') : 'gray'}
      icon={<FontAwesomeIcon icon={result ? (result.ok ? faCheck : faExclamationTriangle) : faCircleQuestion} />}
      title={title}
    >
      {!result
        ? t('pages.admin.nodes.tabs.configuration.page.alert.verifyNotTested', {})
        : result.ok
          ? t('pages.admin.nodes.tabs.configuration.page.alert.verifySuccess', { version: result.version })
          : renderError(result.error)}
    </Alert>
  );
}

export default function AdminNodeConfiguration({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [remote, setRemote] = useState(window.location.origin);
  const [apiPort, setApiPort] = useState(() => getNodeDefaultApiPort(node));
  const [sftpPort, setSftpPort] = useState(node.sftpPort);

  const connectPort = getNodeConnectPort(node);
  const portMismatch = !isNodeAIO(node) && connectPort !== null && connectPort !== apiPort;

  const [verifying, setVerifying] = useState(false);
  const [backendResult, setBackendResult] = useState<VerifyResult | null>(null);
  const [frontendResult, setFrontendResult] = useState<VerifyResult | null>(null);

  const { data: nodeToken } = useResource({
    queryKey: queryKeys.admin.nodes.token(node.uuid),
    queryFn: useCallback(() => getNodeToken(node.uuid), [node.uuid]),
  });

  const doVerify = () => {
    if (!nodeToken) return;

    setVerifying(true);
    setBackendResult(null);
    setFrontendResult(null);

    const backendCheck = getNodeSystemOverview(node.uuid)
      .then((overview) => setBackendResult({ ok: true, version: overview.version }))
      .catch((err) => setBackendResult({ ok: false, error: httpErrorToHuman(err) }));

    const frontendCheck = axiosInstance
      .get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${nodeToken.token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
      .then(({ data }) => setFrontendResult({ ok: true, version: data.version ?? 'unknown' }))
      .catch((err) => setFrontendResult({ ok: false, error: httpErrorToHuman(err) }));

    Promise.allSettled([backendCheck, frontendCheck]).finally(() => setVerifying(false));
  };

  const configurationParams = useMemo(() => {
    if (!nodeToken) {
      return null;
    }

    return { node, token: nodeToken, remote, apiPort, sftpPort };
  }, [node, nodeToken, remote, apiPort, sftpPort]);

  const nodeConfiguration = useMemo(
    () => (configurationParams ? getNodeConfiguration(configurationParams) : null),
    [configurationParams],
  );
  const command = useMemo(
    () => (configurationParams ? getNodeConfigurationCommand(configurationParams) : null),
    [configurationParams],
  );

  const [revealed, setRevealed] = useState(false);
  const [yaml, setYaml] = useState<string | null>(null);
  const [liveConfigError, setLiveConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const doSaveRef = useRef<() => void>(() => null);

  useEffect(() => {
    getNodeConfig(node.uuid)
      .then((config) => {
        setYaml(dump(config, { lineWidth: -1 }));
      })
      .catch((err) => {
        setLiveConfigError(httpErrorToHuman(err));
      });
  }, [node.uuid]);

  const doSave = () => {
    if (yaml === null || liveConfigError !== null) return;

    let parsed: object;
    try {
      parsed = load(yaml) as object;
    } catch (err) {
      addToast(
        t('pages.admin.nodes.tabs.configuration.page.toast.invalidYaml', { error: (err as Error).message }),
        'error',
      );
      return;
    }

    setSaving(true);
    updateNodeConfig(node.uuid, parsed)
      .then((applied) => {
        if (applied) {
          addToast(t('pages.admin.nodes.tabs.configuration.page.toast.applied', {}), 'success');
        } else {
          addToast(t('pages.admin.nodes.tabs.configuration.page.toast.submittedNotApplied', {}), 'warning');
        }
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setSaving(false));
  };

  doSaveRef.current = doSave;

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.configuration.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.configuration.subContainer}
      registryProps={{ node }}
    >
      {!revealed ? (
        <Stack>
          <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
            {t('pages.admin.nodes.tabs.configuration.page.alert.tokenWarning', {})}
          </Alert>
          <div>
            <Button onClick={() => setRevealed(true)}>
              <Group gap='xs'>
                <FontAwesomeIcon icon={faEye} />
                {t('pages.admin.nodes.tabs.configuration.page.button.reveal', {})}
              </Group>
            </Button>
          </div>
        </Stack>
      ) : (
        <Stack gap='xl'>
          <div>
            <Title order={4} mb='md'>
              {t('pages.admin.nodes.tabs.configuration.page.section.initialSetup', {})}
            </Title>
            <Stack gap='lg' className='min-w-0'>
              <div className='min-w-0'>
                <Title order={5} mb='xs'>
                  1. {t('pages.admin.nodes.tabs.configuration.page.step.settings', {})}
                </Title>
                <Text size='sm' c='dimmed' mb='sm'>
                  {t('pages.admin.nodes.tabs.configuration.page.description.settings', {})}
                </Text>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <TextInput
                    name='remote'
                    label={t('pages.admin.nodes.tabs.configuration.page.form.panelUrl', {})}
                    description={t('pages.admin.nodes.tabs.configuration.page.form.panelUrlDescription', {})}
                    value={remote}
                    onChange={(e) => setRemote(e.target.value)}
                  />
                  <NumberInput
                    name='api_port'
                    label={t('pages.admin.nodes.tabs.configuration.page.form.apiPort', {})}
                    description={t('pages.admin.nodes.tabs.configuration.page.form.apiPortDescription', {})}
                    value={apiPort}
                    min={1}
                    max={65535}
                    onChange={(value) => setApiPort(Number(value) || WINGS_DEFAULT_PORT)}
                  />
                  <NumberInput
                    name='sftp_port'
                    label={t('common.form.sftpPort', {})}
                    description={t('pages.admin.nodes.tabs.configuration.page.form.sftpPortDescription', {})}
                    value={sftpPort}
                    min={1}
                    max={65535}
                    onChange={(value) => setSftpPort(Number(value) || node.sftpPort)}
                  />
                </div>
                {portMismatch && (
                  <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mt='md'>
                    {t('pages.admin.nodes.tabs.configuration.page.alert.portMismatch', {
                      connectPort: String(connectPort),
                      apiPort: String(apiPort),
                    }).md()}
                  </Alert>
                )}
              </div>

              <div className='min-w-0'>
                <Title order={5} mb='xs'>
                  2. {t('pages.admin.nodes.tabs.configuration.page.step.install', {})}
                </Title>
                {nodeConfiguration && command ? (
                  <>
                    <HljsCode
                      className='overflow-x-auto'
                      languageName='yaml'
                      language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
                    >
                      {dump(nodeConfiguration)}
                    </HljsCode>

                    <div className='mt-2'>
                      <p>{t('pages.admin.nodes.tabs.configuration.page.description.placeFile', {}).md()}</p>
                      <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
                        <Code block className='flex-1 min-w-0 overflow-x-auto'>
                          {command}
                        </Code>
                        <Tooltip label={t('pages.admin.nodes.tabs.configuration.page.tooltip.copyCommand', {})}>
                          <ActionIcon variant='subtle' onClick={handleCopyToClipboard(command, addToast)} size='lg'>
                            <FontAwesomeIcon icon={faCopy} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </div>
                  </>
                ) : (
                  <Spinner.Centered />
                )}
              </div>

              <div>
                <Title order={5} mb='xs'>
                  3. {t('pages.admin.nodes.tabs.configuration.page.step.verify', {})}
                </Title>
                <Text size='sm' c='dimmed' mb='sm'>
                  {t('pages.admin.nodes.tabs.configuration.page.description.verify', {})}
                </Text>
                <Stack gap='sm' align='flex-start'>
                  <Button
                    onClick={doVerify}
                    loading={verifying}
                    disabled={!nodeToken}
                    leftSection={<FontAwesomeIcon icon={faCheck} />}
                  >
                    {t('pages.admin.nodes.tabs.configuration.page.button.verify', {})}
                  </Button>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 w-full'>
                    <VerifyStatusAlert
                      title={t('pages.admin.nodes.tabs.configuration.page.alert.verifyBackend', {})}
                      result={backendResult}
                      renderError={(error) => (
                        <Stack gap='xs'>
                          {t('pages.admin.nodes.tabs.configuration.page.alert.verifyFailed', { error })}
                          {urlIsMissingPort(node.url) &&
                            t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
                              port: String(connectPort ?? 443),
                              wingsPort: String(WINGS_DEFAULT_PORT),
                            }).md()}
                        </Stack>
                      )}
                    />
                    <VerifyStatusAlert
                      title={t('pages.admin.nodes.tabs.configuration.page.alert.verifyFrontend', {})}
                      result={frontendResult}
                      renderError={(error) =>
                        t('pages.admin.nodes.tabs.configuration.page.alert.verifyFrontendFailed', { error })
                      }
                    />
                  </div>
                </Stack>
              </div>
            </Stack>
          </div>

          <Divider />

          <div>
            <Group justify='space-between' mb='md'>
              <Title order={4}>{t('pages.admin.nodes.tabs.configuration.page.section.liveConfiguration', {})}</Title>
              <Button onClick={doSave} loading={saving} disabled={yaml === null || liveConfigError !== null}>
                {t('pages.admin.nodes.tabs.configuration.page.button.save', {})}
              </Button>
            </Group>
            {liveConfigError ? (
              <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                <Stack gap='xs'>
                  {t('pages.admin.nodes.tabs.configuration.page.alert.couldNotReach', { error: liveConfigError })}
                  {urlIsMissingPort(node.url) &&
                    t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
                      port: String(connectPort ?? 443),
                      wingsPort: String(WINGS_DEFAULT_PORT),
                    }).md()}
                </Stack>
              </Alert>
            ) : yaml === null ? (
              <Spinner.Centered />
            ) : (
              <div className='rounded-md overflow-hidden'>
                <MonacoEditor
                  height='65vh'
                  theme='vs-dark'
                  language='yaml'
                  value={yaml}
                  onChange={(value) => setYaml(value ?? '')}
                  onMount={(editor, monaco) => {
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      doSaveRef.current();
                    });
                  }}
                  options={{
                    stickyScroll: { enabled: false },
                    minimap: { enabled: false },
                    codeLens: false,
                    scrollBeyondLastLine: false,
                    smoothScrolling: false,
                    // @ts-expect-error this is valid
                    touchScrollEnabled: true,
                  }}
                />
              </div>
            )}
          </div>
        </Stack>
      )}
    </AdminSubContentContainer>
  );
}

import { faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Divider, Group, Stack, Title } from '@mantine/core';
import jsYaml from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeConfig from '@/api/admin/nodes/getNodeConfig.ts';
import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import updateNodeConfig from '@/api/admin/nodes/updateNodeConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import { getNodeConfiguration, getNodeConfigurationCommand } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminNodeConfiguration({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [remote, setRemote] = useState(window.location.origin);
  const [apiPort, setApiPort] = useState(parseInt(new URL(node.url).port || '8080'));
  const [sftpPort, setSftpPort] = useState(node.sftpPort);
  const { data: nodeToken } = useResource({
    queryKey: queryKeys.admin.nodes.token(node.uuid),
    queryFn: useCallback(() => getNodeToken(node.uuid), [node.uuid]),
  });
  const tokenId = nodeToken?.tokenId;
  const bearerToken = nodeToken?.token;

  const configurationParams = useMemo(() => {
    if (!tokenId || !bearerToken) {
      return null;
    }

    return { node, tokenId, token: bearerToken, remote, apiPort, sftpPort };
  }, [node, tokenId, bearerToken, remote, apiPort, sftpPort]);

  const nodeConfiguration = useMemo(
    () => (configurationParams ? getNodeConfiguration(configurationParams) : null),
    [configurationParams],
  );
  const command = useMemo(
    () => (configurationParams ? getNodeConfigurationCommand(configurationParams) : null),
    [configurationParams],
  );

  const [yaml, setYaml] = useState<string | null>(null);
  const [liveConfigError, setLiveConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const doSaveRef = useRef<() => void>(() => null);

  useEffect(() => {
    getNodeConfig(node.uuid)
      .then((config) => {
        setYaml(jsYaml.dump(config, { lineWidth: -1 }));
      })
      .catch((err) => {
        setLiveConfigError(httpErrorToHuman(err));
      });
  }, [node.uuid]);

  const doSave = () => {
    if (yaml === null || liveConfigError !== null) return;

    let parsed: object;
    try {
      parsed = jsYaml.load(yaml) as object;
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
      contentRight={
        <Button onClick={doSave} loading={saving} disabled={yaml === null || liveConfigError !== null}>
          {t('pages.admin.nodes.tabs.configuration.page.button.save', {})}
        </Button>
      }
    >
      <Stack gap='xl'>
        <div>
          <Title order={4} mb='md'>
            {t('pages.admin.nodes.tabs.configuration.page.section.initialSetup', {})}
          </Title>
          <div className='grid md:grid-cols-4 grid-cols-1 gap-4'>
            <div className='flex flex-col md:col-span-3'>
              {nodeConfiguration && command ? (
                <>
                  <HljsCode
                    languageName='yaml'
                    language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
                  >
                    {jsYaml.dump(nodeConfiguration)}
                  </HljsCode>

                  <div className='mt-2'>
                    <p>{t('pages.admin.nodes.tabs.configuration.page.description.placeFile', {}).md()}</p>
                    <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
                      <Code block className='flex-1'>
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
            <Card>
              <Title className='text-right'>{t('pages.admin.nodes.tabs.configuration.page.title', {})}</Title>

              <Stack>
                <TextInput
                  name='remote'
                  label={t('pages.admin.nodes.tabs.configuration.page.form.panelUrl', {})}
                  value={remote}
                  onChange={(e) => setRemote(e.target.value)}
                />
                <NumberInput
                  name='api_port'
                  label={t('pages.admin.nodes.tabs.configuration.page.form.apiPort', {})}
                  value={apiPort}
                  min={1}
                  max={65535}
                  onChange={(value) => setApiPort(Number(value))}
                />
                <NumberInput
                  name='sftp_port'
                  label={t('common.form.sftpPort', {})}
                  value={sftpPort}
                  min={1}
                  max={65535}
                  onChange={(value) => setSftpPort(Number(value))}
                />
              </Stack>
            </Card>
          </div>
        </div>

        <Divider />

        <div>
          <Title order={4} mb='md'>
            {t('pages.admin.nodes.tabs.configuration.page.section.liveConfiguration', {})}
          </Title>
          {liveConfigError ? (
            <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
              {t('pages.admin.nodes.tabs.configuration.page.alert.couldNotReach', { error: liveConfigError })}
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
                  smoothScrolling: true,
                  // @ts-expect-error this is valid
                  touchScrollEnabled: true,
                }}
              />
            </div>
          )}
        </div>
      </Stack>
    </AdminSubContentContainer>
  );
}

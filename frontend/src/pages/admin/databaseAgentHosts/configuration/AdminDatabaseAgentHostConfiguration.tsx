import { faCopy, faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dump, load } from 'js-yaml';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHostConfig from '@/api/admin/database-agent-hosts/getDatabaseAgentHostConfig.ts';
import getDatabaseAgentHostToken from '@/api/admin/database-agent-hosts/getDatabaseAgentHostToken.ts';
import updateDatabaseAgentHostConfig from '@/api/admin/database-agent-hosts/updateDatabaseAgentHostConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import {
  getDatabaseAgentHostConfiguration,
  getDatabaseAgentHostConfigurationCommand,
} from '@/lib/databaseAgentHost.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminDatabaseAgentHostConfiguration({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [apiPort, setApiPort] = useState(parseInt(new URL(databaseAgentHost.url).port || '8080'));
  const { data: hostToken } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.token(databaseAgentHost.uuid),
    queryFn: useCallback(() => getDatabaseAgentHostToken(databaseAgentHost.uuid), [databaseAgentHost.uuid]),
  });

  const configurationParams = useMemo(() => {
    if (!hostToken) {
      return null;
    }

    return { token: hostToken, apiPort };
  }, [hostToken, apiPort]);

  const hostConfiguration = useMemo(
    () => (configurationParams ? getDatabaseAgentHostConfiguration(configurationParams) : null),
    [configurationParams],
  );
  const command = useMemo(
    () => (configurationParams ? getDatabaseAgentHostConfigurationCommand(configurationParams) : null),
    [configurationParams],
  );

  const [revealed, setRevealed] = useState(false);
  const [yaml, setYaml] = useState<string | null>(null);
  const [liveConfigError, setLiveConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const doSaveRef = useRef<() => void>(() => null);

  useEffect(() => {
    getDatabaseAgentHostConfig(databaseAgentHost.uuid)
      .then((config) => {
        setYaml(dump(config, { lineWidth: -1 }));
      })
      .catch((err) => {
        setLiveConfigError(httpErrorToHuman(err));
      });
  }, [databaseAgentHost.uuid]);

  const doSave = () => {
    if (yaml === null || liveConfigError !== null) return;

    let parsed: object;
    try {
      parsed = load(yaml) as object;
    } catch (err) {
      addToast(
        t('pages.admin.databaseAgentHosts.tabs.configuration.page.toast.invalidYaml', {
          error: (err as Error).message,
        }),
        'error',
      );
      return;
    }

    setSaving(true);
    updateDatabaseAgentHostConfig(databaseAgentHost.uuid, parsed)
      .then((applied) => {
        if (applied) {
          addToast(t('pages.admin.databaseAgentHosts.tabs.configuration.page.toast.applied', {}), 'success');
        } else {
          addToast(
            t('pages.admin.databaseAgentHosts.tabs.configuration.page.toast.submittedNotApplied', {}),
            'warning',
          );
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
      title={t('pages.admin.databaseAgentHosts.tabs.configuration.page.title', {})}
      titleOrder={2}
      contentRight={
        revealed ? (
          <Button onClick={doSave} loading={saving} disabled={yaml === null || liveConfigError !== null}>
            {t('pages.admin.databaseAgentHosts.tabs.configuration.page.button.save', {})}
          </Button>
        ) : undefined
      }
    >
      {!revealed ? (
        <Stack>
          <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
            {t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.tokenWarning', {})}
          </Alert>
          <div>
            <Button onClick={() => setRevealed(true)}>
              <Group gap='xs'>
                <FontAwesomeIcon icon={faEye} />
                {t('pages.admin.databaseAgentHosts.tabs.configuration.page.button.reveal', {})}
              </Group>
            </Button>
          </div>
        </Stack>
      ) : (
        <Stack gap='xl'>
          <div>
            <Title order={4} mb='md'>
              {t('pages.admin.databaseAgentHosts.tabs.configuration.page.section.initialSetup', {})}
            </Title>
            <div className='grid md:grid-cols-4 grid-cols-1 gap-4'>
              <div className='flex flex-col md:col-span-3'>
                {hostConfiguration && command ? (
                  <>
                    <HljsCode
                      languageName='yaml'
                      language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
                    >
                      {dump(hostConfiguration)}
                    </HljsCode>

                    <div className='mt-2'>
                      <p>
                        {t('pages.admin.databaseAgentHosts.tabs.configuration.page.description.placeFile', {}).md()}
                      </p>
                      <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
                        <Code block className='flex-1'>
                          {command}
                        </Code>
                        <Tooltip
                          label={t('pages.admin.databaseAgentHosts.tabs.configuration.page.tooltip.copyCommand', {})}
                        >
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
                <Title className='text-right'>
                  {t('pages.admin.databaseAgentHosts.tabs.configuration.page.title', {})}
                </Title>

                <Stack>
                  <NumberInput
                    name='api_port'
                    label={t('pages.admin.databaseAgentHosts.tabs.configuration.page.form.apiPort', {})}
                    value={apiPort}
                    min={1}
                    max={65535}
                    onChange={(value) => setApiPort(Number(value))}
                  />
                </Stack>
              </Card>
            </div>
          </div>

          <Divider />

          <div>
            <Title order={4} mb='md'>
              {t('pages.admin.databaseAgentHosts.tabs.configuration.page.section.liveConfiguration', {})}
            </Title>
            {liveConfigError ? (
              <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.couldNotReach', {
                  error: liveConfigError,
                })}
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

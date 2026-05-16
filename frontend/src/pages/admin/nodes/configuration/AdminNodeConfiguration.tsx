import { faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Divider, Group, Stack, Title } from '@mantine/core';
import jsYaml from 'js-yaml';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeConfig from '@/api/admin/nodes/getNodeConfig.ts';
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
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function AdminNodeConfiguration({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { addToast } = useToast();

  const [remote, setRemote] = useState(window.location.origin);
  const [apiPort, setApiPort] = useState(parseInt(new URL(node.url).port || '8080'));
  const [sftpPort, setSftpPort] = useState(node.sftpPort);

  const nodeConfiguration = getNodeConfiguration({ node, remote, apiPort, sftpPort });
  const command = getNodeConfigurationCommand({ node, remote, apiPort, sftpPort });

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
      addToast(`Invalid YAML: ${(err as Error).message}`, 'error');
      return;
    }

    setSaving(true);
    updateNodeConfig(node.uuid, parsed)
      .then((applied) => {
        if (applied) {
          addToast('Configuration applied successfully.', 'success');
        } else {
          addToast('Configuration was submitted but not applied.', 'warning');
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
      title='Configuration'
      titleOrder={2}
      contentRight={
        <Button onClick={doSave} loading={saving} disabled={yaml === null || liveConfigError !== null}>
          Save Configuration
        </Button>
      }
    >
      <Stack gap='xl'>
        <div>
          <Title order={4} c='white' mb='md'>
            Initial Setup
          </Title>
          <div className='grid md:grid-cols-4 grid-cols-1 gap-4'>
            <div className='flex flex-col md:col-span-3'>
              <HljsCode
                languageName='yaml'
                language={() => import('highlight.js/lib/languages/yaml').then((mod) => mod.default)}
              >
                {jsYaml.dump(nodeConfiguration)}
              </HljsCode>

              <div className='mt-2'>
                <p>
                  Place this into the configuration file at <Code>/etc/pterodactyl/config.yml</Code> or run
                </p>
                <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
                  <Code block className='flex-1'>
                    {command}
                  </Code>
                  <Tooltip label='Copy command'>
                    <ActionIcon variant='subtle' onClick={handleCopyToClipboard(command, addToast)} size='lg'>
                      <FontAwesomeIcon icon={faCopy} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </div>
            </div>
            <Card>
              <Title className='text-right'>Configuration</Title>

              <Stack>
                <TextInput name='remote' label='Panel URL' value={remote} onChange={(e) => setRemote(e.target.value)} />
                <NumberInput
                  name='api_port'
                  label='API Port'
                  value={apiPort}
                  min={1}
                  max={65535}
                  onChange={(value) => setApiPort(Number(value))}
                />
                <NumberInput
                  name='sftp_port'
                  label='SFTP Port'
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
          <Title order={4} c='white' mb='md'>
            Live Configuration
          </Title>
          {liveConfigError ? (
            <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
              Could not reach the node: {liveConfigError}
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

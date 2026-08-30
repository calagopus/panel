import { faCheck, faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text } from '@mantine/core';
import { dump } from 'js-yaml';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Group from '@/elements/Group.tsx';
import HljsCode from '@/elements/HljsCode.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { handleCopyToClipboard } from '@/lib/copy.ts';
import { getNodeConfiguration, WINGS_DEFAULT_PORT } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { urlIsMissingPort } from '@/lib/url.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import VerifyStatusAlert, { VerifyResult } from './VerifyStatusAlert.tsx';

const loadYamlLanguage = () => import('highlight.js/lib/languages/yaml').then((mod) => mod.default);

export interface NodeConnectionSettings {
  remote: string;
  setRemote: (value: string) => void;
  apiPort: number;
  setApiPort: (value: number) => void;
  sftpPort: number;
  setSftpPort: (value: number) => void;
  connectPort: number | null;
  portMismatch: boolean;
}

export interface NodeInstallStep {
  nodeConfiguration: ReturnType<typeof getNodeConfiguration> | null;
  command: string | null;
}

export interface NodeVerificationState {
  nodeToken: unknown;
  verifying: boolean;
  doVerify: () => void;
  backendResult: VerifyResult | null;
  frontendResult: VerifyResult | null;
}

export default function NodeInitialSetupSection({
  node,
  settings,
  installStep,
  verification,
}: {
  node: z.infer<typeof adminNodeSchema>;
  settings: NodeConnectionSettings;
  installStep: NodeInstallStep;
  verification: NodeVerificationState;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { remote, setRemote, apiPort, setApiPort, sftpPort, setSftpPort, connectPort, portMismatch } = settings;
  const { nodeConfiguration, command } = installStep;
  const { nodeToken, verifying, doVerify, backendResult, frontendResult } = verification;

  return (
    <>
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
                <HljsCode className='overflow-x-auto' languageName='yaml' language={loadYamlLanguage}>
                  {dump(nodeConfiguration)}
                </HljsCode>

                <div className='mt-2'>
                  {t('pages.admin.nodes.tabs.configuration.page.description.placeFile', {}).md()}
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
    </>
  );
}

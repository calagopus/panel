import { faCheck, faCircleQuestion, faCopy, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dump } from 'js-yaml';
import { ReactNode } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import HljsCode from '@/elements/editors/HljsCode.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { handleCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { DATABASE_AGENT_DEFAULT_PORT, getDatabaseAgentHostConfiguration } from '@/lib/domain/databaseAgentHost.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type VerifyResult = { ok: true } | { ok: false; error: string };

const loadYamlLanguage = () => import('highlight.js/lib/languages/yaml').then((mod) => mod.default);

export default function DatabaseAgentHostInitialSetupSection({
  apiPort,
  setApiPort,
  connectPort,
  portMismatch,
  hostConfiguration,
  command,
  verifying,
  verifyResult,
  onVerify,
  urlMissingPortHint,
}: {
  apiPort: number;
  setApiPort: (value: number) => void;
  connectPort: number | null;
  portMismatch: boolean;
  hostConfiguration: ReturnType<typeof getDatabaseAgentHostConfiguration> | null;
  command: string | null;
  verifying: boolean;
  verifyResult: VerifyResult | null;
  onVerify: () => void;
  urlMissingPortHint: ReactNode;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  return (
    <div>
      <Title order={4} mb='md'>
        {t('pages.admin.databaseAgentHosts.tabs.configuration.page.section.initialSetup', {})}
      </Title>
      <Stack gap='lg' className='min-w-0'>
        <div className='min-w-0'>
          <Title order={5} mb='xs'>
            1. {t('pages.admin.databaseAgentHosts.tabs.configuration.page.step.settings', {})}
          </Title>
          <Text size='sm' c='dimmed' mb='sm'>
            {t('pages.admin.databaseAgentHosts.tabs.configuration.page.description.settings', {})}
          </Text>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <NumberInput
              name='api_port'
              label={t('pages.admin.databaseAgentHosts.tabs.configuration.page.form.apiPort', {})}
              description={t('pages.admin.databaseAgentHosts.tabs.configuration.page.form.apiPortDescription', {})}
              value={apiPort}
              min={1}
              max={65535}
              onChange={(value) => setApiPort(Number(value) || DATABASE_AGENT_DEFAULT_PORT)}
            />
          </div>
          {portMismatch && (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mt='md'>
              {t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.portMismatch', {
                connectPort: String(connectPort),
                apiPort: String(apiPort),
              }).md()}
            </Alert>
          )}
        </div>

        <div className='min-w-0'>
          <Title order={5} mb='xs'>
            2. {t('pages.admin.databaseAgentHosts.tabs.configuration.page.step.install', {})}
          </Title>
          {hostConfiguration && command ? (
            <>
              <HljsCode className='overflow-x-auto' languageName='yaml' language={loadYamlLanguage}>
                {dump(hostConfiguration)}
              </HljsCode>

              <div className='mt-2'>
                {t('pages.admin.databaseAgentHosts.tabs.configuration.page.description.placeFile', {}).md()}
                <Group gap='xs' align='flex-start' wrap='nowrap' className='mt-2'>
                  <Code block className='flex-1 min-w-0 overflow-x-auto'>
                    {command}
                  </Code>
                  <Tooltip label={t('pages.admin.databaseAgentHosts.tabs.configuration.page.tooltip.copyCommand', {})}>
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

        <AdminCan action='database-agent-hosts.test'>
          <div className='min-w-0'>
            <Title order={5} mb='xs'>
              3. {t('pages.admin.databaseAgentHosts.tabs.configuration.page.step.verify', {})}
            </Title>
            <Text size='sm' c='dimmed' mb='sm'>
              {t('pages.admin.databaseAgentHosts.tabs.configuration.page.description.verify', {})}
            </Text>
            <Stack gap='sm' align='flex-start'>
              <Button onClick={onVerify} loading={verifying} leftSection={<FontAwesomeIcon icon={faCheck} />}>
                {t('pages.admin.databaseAgentHosts.tabs.configuration.page.button.verify', {})}
              </Button>
              <Alert
                color={verifyResult ? (verifyResult.ok ? 'green' : 'red') : 'gray'}
                icon={
                  <FontAwesomeIcon
                    icon={verifyResult ? (verifyResult.ok ? faCheck : faExclamationTriangle) : faCircleQuestion}
                  />
                }
                title={t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.verifyTitle', {})}
                className='w-full'
              >
                {!verifyResult ? (
                  t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.verifyNotTested', {})
                ) : verifyResult.ok ? (
                  t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.verifySuccess', {})
                ) : (
                  <Stack gap='xs'>
                    {t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.verifyFailed', {
                      error: verifyResult.error,
                    })}
                    {urlMissingPortHint}
                  </Stack>
                )}
              </Alert>
            </Stack>
          </div>
        </AdminCan>
      </Stack>
    </div>
  );
}

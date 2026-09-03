import { faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dump, load } from 'js-yaml';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHostConfig from '@/api/admin/database-agent-hosts/getDatabaseAgentHostConfig.ts';
import getDatabaseAgentHostToken from '@/api/admin/database-agent-hosts/getDatabaseAgentHostToken.ts';
import testDatabaseAgentHost from '@/api/admin/database-agent-hosts/testDatabaseAgentHost.ts';
import updateDatabaseAgentHostConfig from '@/api/admin/database-agent-hosts/updateDatabaseAgentHostConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import LiveYamlConfigSection from '@/elements/admin/LiveYamlConfigSection.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import {
  DATABASE_AGENT_DEFAULT_PORT,
  getDatabaseAgentHostConfiguration,
  getDatabaseAgentHostConfigurationCommand,
} from '@/lib/domain/databaseAgentHost.ts';
import { getUrlConnectPort, getUrlPortOr, urlIsMissingPort } from '@/lib/network/url.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentHostInitialSetupSection, { VerifyResult } from './DatabaseAgentHostInitialSetupSection.tsx';

export default function AdminDatabaseAgentHostConfiguration({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const canReadToken = useAdminCan('database-agent-hosts.read-token');
  const canUpdate = useAdminCan('database-agent-hosts.update');

  const [apiPort, setApiPort] = useState(() => getUrlPortOr(databaseAgentHost.url, DATABASE_AGENT_DEFAULT_PORT));
  const { data: hostToken } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.token(databaseAgentHost.uuid),
    queryFn: useCallback(() => getDatabaseAgentHostToken(databaseAgentHost.uuid), [databaseAgentHost.uuid]),
    enabled: canReadToken,
  });

  const connectPort = getUrlConnectPort(databaseAgentHost.url);
  const portMismatch = connectPort !== null && connectPort !== apiPort;

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const doVerify = () => {
    setVerifying(true);
    setVerifyResult(null);

    testDatabaseAgentHost(databaseAgentHost.uuid)
      .then(() => setVerifyResult({ ok: true }))
      .catch((err) => setVerifyResult({ ok: false, error: httpErrorToHuman(err) }))
      .finally(() => setVerifying(false));
  };

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
    if (!canUpdate || yaml === null || liveConfigError !== null) return;

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

  const urlMissingPortHint = urlIsMissingPort(databaseAgentHost.url)
    ? t('pages.admin.databaseAgentHosts.tabs.general.page.alert.urlMissingPort', {
        port: String(connectPort ?? 443),
        agentPort: String(DATABASE_AGENT_DEFAULT_PORT),
      }).md()
    : null;

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.configuration.page.title', {})}
      titleOrder={2}
      registry={
        window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.configuration.subContainer
      }
      registryProps={{ databaseAgentHost }}
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
          <AdminCan action='database-agent-hosts.read-token'>
            <DatabaseAgentHostInitialSetupSection
              apiPort={apiPort}
              setApiPort={setApiPort}
              connectPort={connectPort}
              portMismatch={portMismatch}
              hostConfiguration={hostConfiguration}
              command={command}
              verifying={verifying}
              verifyResult={verifyResult}
              onVerify={doVerify}
              urlMissingPortHint={urlMissingPortHint}
            />

            <Divider />
          </AdminCan>

          <LiveYamlConfigSection
            title={t('pages.admin.databaseAgentHosts.tabs.configuration.page.section.liveConfiguration', {})}
            saveLabel={t('pages.admin.databaseAgentHosts.tabs.configuration.page.button.save', {})}
            updateAction='database-agent-hosts.update'
            yaml={yaml}
            onYamlChange={setYaml}
            onSave={doSave}
            saving={saving}
            error={liveConfigError}
            errorText={
              liveConfigError
                ? t('pages.admin.databaseAgentHosts.tabs.configuration.page.alert.couldNotReach', {
                    error: liveConfigError,
                  })
                : null
            }
            errorExtra={urlMissingPortHint}
          />
        </Stack>
      )}
    </AdminSubContentContainer>
  );
}

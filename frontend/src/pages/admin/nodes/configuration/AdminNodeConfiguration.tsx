import { faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { dump, load } from 'js-yaml';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getNodeConfig from '@/api/admin/nodes/getNodeConfig.ts';
import getNodeToken from '@/api/admin/nodes/getNodeToken.ts';
import getNodeSystemDirect from '@/api/admin/nodes/system/getNodeSystemDirect.ts';
import getNodeSystemOverview from '@/api/admin/nodes/system/getNodeSystemOverview.ts';
import updateNodeConfig from '@/api/admin/nodes/updateNodeConfig.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import {
  getNodeConfiguration,
  getNodeConfigurationCommand,
  getNodeConnectPort,
  getNodeDefaultApiPort,
  isNodeAIO,
} from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeInitialSetupSection from './NodeInitialSetupSection.tsx';
import NodeLiveConfigurationSection from './NodeLiveConfigurationSection.tsx';
import { VerifyResult } from './VerifyStatusAlert.tsx';

export default function AdminNodeConfiguration({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const canReadToken = useAdminCan('nodes.read-token');
  const canUpdate = useAdminCan('nodes.update');

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
    enabled: canReadToken,
  });

  const doVerify = () => {
    if (!nodeToken) return;

    setVerifying(true);
    setBackendResult(null);
    setFrontendResult(null);

    const backendCheck = getNodeSystemOverview(node.uuid)
      .then((overview) => setBackendResult({ ok: true, version: overview.version }))
      .catch((err) => setBackendResult({ ok: false, error: httpErrorToHuman(err) }));

    const frontendCheck = getNodeSystemDirect(node)
      .then(({ version }) => setFrontendResult({ ok: true, version: version ?? 'unknown' }))
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
  const [saving, setSaving] = useState(false);

  const { data: liveConfig, error: liveConfigErrorRaw } = useResource({
    queryKey: queryKeys.admin.nodes.config(node.uuid),
    queryFn: useCallback(() => getNodeConfig(node.uuid), [node.uuid]),
    silent: true,
  });
  const liveConfigError = liveConfigErrorRaw ? httpErrorToHuman(liveConfigErrorRaw) : null;

  useEffect(() => {
    if (liveConfig) {
      setYaml(dump(liveConfig, { lineWidth: -1 }));
    }
  }, [liveConfig]);

  const doSave = () => {
    if (!canUpdate || yaml === null || liveConfigError !== null) return;

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

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.configuration.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.configuration.subContainer}
      registryProps={{ node }}
    >
      {canReadToken && !revealed ? (
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
          {canReadToken && (
            <>
              <NodeInitialSetupSection
                node={node}
                settings={{ remote, setRemote, apiPort, setApiPort, sftpPort, setSftpPort, connectPort, portMismatch }}
                installStep={{ nodeConfiguration, command }}
                verification={{ nodeToken, verifying, doVerify, backendResult, frontendResult }}
              />

              <Divider />
            </>
          )}

          <NodeLiveConfigurationSection
            nodeUrl={node.url}
            connectPort={connectPort}
            liveConfig={{ yaml, setYaml, liveConfigError, saving, doSave }}
          />
        </Stack>
      )}
    </AdminSubContentContainer>
  );
}

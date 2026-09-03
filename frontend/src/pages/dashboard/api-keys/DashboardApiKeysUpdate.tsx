import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import getApiKeyByIdentifier from '@/api/me/api-keys/getApiKeyByIdentifier.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import Button from '@/elements/buttons/Button.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import RequestedPermissions, { type RequestedPermission } from '@/pages/dashboard/api-keys/RequestedPermissions.tsx';
import { parseCallbackUrl, parseRequestedPermissions } from '@/pages/dashboard/api-keys/redirectParams.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

function resolvePermissions(existing: string[], requested: string[], replace: boolean) {
  const final = replace ? [...requested].sort() : Array.from(new Set([...existing, ...requested])).sort();
  const entries: RequestedPermission[] = Array.from(new Set([...existing, ...final]))
    .sort()
    .map((permission) => ({
      permission,
      tone: !final.includes(permission) ? 'removed' : existing.includes(permission) ? 'existing' : 'added',
    }));

  return { final, entries, changed: entries.some((entry) => entry.tone !== 'existing') };
}

export default function DashboardApiKeysUpdate() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);
  const setAvailablePermissions = useGlobalStore((state) => state.setAvailablePermissions);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  const keyStart = searchParams.get('key_start') ?? '';
  const replace = searchParams.get('mode') === 'replace';

  const apiKey = useResource({
    queryKey: queryKeys.user.apiKeys.detail(keyStart),
    queryFn: () => getApiKeyByIdentifier(keyStart),
    enabled: !!keyStart,
  });

  useEffect(() => {
    getPermissions()
      .then((res) => {
        setAvailablePermissions(res);
        setPermissionsLoaded(true);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });
  }, []);

  const callbackUrl = useMemo(() => parseCallbackUrl(searchParams), [searchParams]);

  const requestedPermissions = useMemo(
    () => parseRequestedPermissions(searchParams, availablePermissions, !!user?.admin),
    [searchParams, availablePermissions, user],
  );

  const doUpdate = (key: z.infer<typeof userApiKeySchema>) => {
    setLoading(true);

    const resolved = {
      userPermissions: resolvePermissions(key.userPermissions, requestedPermissions.userPermissions, replace).final,
      serverPermissions: resolvePermissions(key.serverPermissions, requestedPermissions.serverPermissions, replace)
        .final,
      adminPermissions: user?.admin
        ? resolvePermissions(key.adminPermissions, requestedPermissions.adminPermissions, replace).final
        : key.adminPermissions,
    };

    updateApiKey(key.uuid, {
      name: key.name,
      allowedIps: key.allowedIps,
      ...resolved,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });

        if (callbackUrl) {
          window.location.href = callbackUrl.toString();
        } else {
          addToast(t('pages.account.apiKeys.modal.updateApiKey.toast.updated', {}), 'success');
          setUpdated(true);
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AccountContentContainer
      title={t('pages.account.apiKeys.update.title', {})}
      subtitle={t('pages.account.apiKeys.update.subtitle', {})}
    >
      {!permissionsLoaded ? (
        <Spinner.Centered />
      ) : updated ? (
        <Card>
          <Stack align='flex-start'>
            <Text>{t('pages.account.apiKeys.update.keyUpdated', {})}</Text>
            <Button onClick={() => navigate('/account/api-keys')}>
              {t('pages.account.apiKeys.create.button.goToApiKeys', {})}
            </Button>
          </Stack>
        </Card>
      ) : (
        <ResourceView resource={apiKey}>
          {(key) => {
            const groups = {
              userPermissions: resolvePermissions(key.userPermissions, requestedPermissions.userPermissions, replace),
              serverPermissions: resolvePermissions(
                key.serverPermissions,
                requestedPermissions.serverPermissions,
                replace,
              ),
              adminPermissions: user?.admin
                ? resolvePermissions(key.adminPermissions, requestedPermissions.adminPermissions, replace)
                : { entries: [], changed: false },
            };
            const hasAddedAdmin = groups.adminPermissions.entries.some((entry) => entry.tone === 'added');
            const changed =
              groups.userPermissions.changed || groups.serverPermissions.changed || groups.adminPermissions.changed;

            return (
              <Stack>
                {hasAddedAdmin && (
                  <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                    {t('pages.account.apiKeys.create.alert.adminPermissions', {}).md()}
                  </Alert>
                )}
                {replace && (
                  <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                    {t('pages.account.apiKeys.update.alert.replaceMode', {}).md()}
                  </Alert>
                )}
                {callbackUrl && (
                  <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                    {t('pages.account.apiKeys.update.alert.callbackUrl', { url: callbackUrl.origin }).md()}
                  </Alert>
                )}

                <Card>
                  <Title order={5} className='pb-2'>
                    {key.name}
                  </Title>
                  <Code>{key.keyStart}</Code>
                </Card>

                {groups.userPermissions.entries.length > 0 && (
                  <RequestedPermissions
                    label={t('pages.account.apiKeys.form.userPermissions', {})}
                    permissions={groups.userPermissions.entries}
                  />
                )}
                {groups.serverPermissions.entries.length > 0 && (
                  <RequestedPermissions
                    label={t('pages.account.apiKeys.form.serverPermissions', {})}
                    permissions={groups.serverPermissions.entries}
                  />
                )}
                {groups.adminPermissions.entries.length > 0 && (
                  <RequestedPermissions
                    label={t('pages.account.apiKeys.form.adminPermissions', {})}
                    permissions={groups.adminPermissions.entries}
                  />
                )}
                {!changed && <Text c='dimmed'>{t('pages.account.apiKeys.update.noChanges', {})}</Text>}

                <Group>
                  <Button onClick={() => doUpdate(key)} loading={loading}>
                    {t('common.button.update', {})}
                  </Button>
                  <Button variant='default' onClick={() => navigate('/account/api-keys')}>
                    {t('common.button.cancel', {})}
                  </Button>
                </Group>
              </Stack>
            );
          }}
        </ResourceView>
      )}
    </AccountContentContainer>
  );
}

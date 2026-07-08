import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import createApiKey from '@/api/me/api-keys/createApiKey.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { permissionMapSchema } from '@/lib/schemas/generic.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

function RequestedPermissions({ label, permissions }: { label: string; permissions: string[] }) {
  return (
    <Card>
      <Title order={5} className='pb-2'>
        {label}
      </Title>
      <div className='space-y-1'>
        {permissions.map((permission) => (
          <Card key={permission} className='border border-(--mantine-color-default-border)' padding='xs'>
            <span className='text-sm font-mono'>{permission}</span>
          </Card>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardApiKeysCreate() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user } = useAuth();
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);
  const setAvailablePermissions = useGlobalStore((state) => state.setAvailablePermissions);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const form = useForm<{ name: string }>({
    initialValues: {
      name: searchParams.get('name') ?? '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(userApiKeySchema.pick({ name: true })),
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

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callback_url');
    if (!raw) return null;

    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }, [searchParams]);

  const requestedPermissions = useMemo(() => {
    const parseParam = (param: string, available: z.infer<typeof permissionMapSchema>) => {
      const availableKeys = new Set(
        Object.entries(available).flatMap(([category, { permissions: perms }]) =>
          Object.keys(perms).map((perm) => `${category}.${perm}`),
        ),
      );

      return Array.from(
        new Set(
          (searchParams.get(param)?.split(',') ?? [])
            .map((perm) => perm.trim())
            .filter((perm) => availableKeys.has(perm)),
        ),
      ).sort();
    };

    return {
      userPermissions: parseParam('user_permissions', availablePermissions.userPermissions),
      serverPermissions: parseParam('server_permissions', availablePermissions.serverPermissions),
      adminPermissions: user!.admin ? parseParam('admin_permissions', availablePermissions.adminPermissions) : [],
    };
  }, [searchParams, availablePermissions, user]);

  const doCreate = () => {
    setLoading(true);

    createApiKey({
      name: form.values.name,
      allowedIps: [],
      ...requestedPermissions,
      expires: null,
    })
      .then((key) => {
        if (callbackUrl) {
          const url = new URL(callbackUrl);
          url.searchParams.set('key', key.key);
          window.location.href = url.toString();
        } else {
          addToast(t('pages.account.apiKeys.modal.createApiKey.toast.created', {}), 'success');
          setCreatedKey(key.key);
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AccountContentContainer
      title={t('pages.account.apiKeys.create.title', {})}
      subtitle={t('pages.account.apiKeys.create.subtitle', {})}
    >
      {!permissionsLoaded ? (
        <Spinner.Centered />
      ) : createdKey ? (
        <Card>
          <Stack align='flex-start'>
            <Text>{t('pages.account.apiKeys.create.keyCreated', {})}</Text>
            <CopyOnClick content={createdKey}>
              <Code>{createdKey}</Code>
            </CopyOnClick>
            <Button onClick={() => navigate('/account/api-keys')}>
              {t('pages.account.apiKeys.create.button.goToApiKeys', {})}
            </Button>
          </Stack>
        </Card>
      ) : (
        <form onSubmit={form.onSubmit(doCreate)}>
          <Stack>
            {requestedPermissions.adminPermissions.length > 0 && (
              <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.account.apiKeys.create.alert.adminPermissions', {}).md()}
              </Alert>
            )}
            {callbackUrl && (
              <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
                {t('pages.account.apiKeys.create.alert.callbackUrl', { url: callbackUrl.origin }).md()}
              </Alert>
            )}

            <TextInput
              withAsterisk
              label={t('common.form.name', {})}
              key={form.key('name')}
              {...form.getInputProps('name')}
            />

            {requestedPermissions.userPermissions.length > 0 && (
              <RequestedPermissions
                label={t('pages.account.apiKeys.form.userPermissions', {})}
                permissions={requestedPermissions.userPermissions}
              />
            )}
            {requestedPermissions.serverPermissions.length > 0 && (
              <RequestedPermissions
                label={t('pages.account.apiKeys.form.serverPermissions', {})}
                permissions={requestedPermissions.serverPermissions}
              />
            )}
            {requestedPermissions.adminPermissions.length > 0 && (
              <RequestedPermissions
                label={t('pages.account.apiKeys.form.adminPermissions', {})}
                permissions={requestedPermissions.adminPermissions}
              />
            )}
            {requestedPermissions.userPermissions.length === 0 &&
              requestedPermissions.serverPermissions.length === 0 &&
              requestedPermissions.adminPermissions.length === 0 && (
                <Text c='dimmed'>{t('pages.account.apiKeys.create.noPermissions', {})}</Text>
              )}

            <Group>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                {t('common.button.create', {})}
              </Button>
              <Button variant='default' onClick={() => navigate('/account/api-keys')}>
                {t('common.button.cancel', {})}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </AccountContentContainer>
  );
}

import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateRatelimitSettings from '@/api/admin/settings/updateRatelimitSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

type RatelimitsSchema = z.infer<typeof adminSettingsRatelimitsSchema>;
type RatelimitsSchemaKey = keyof RatelimitsSchema;

interface Endpoint {
  label: string;
  key: RatelimitsSchemaKey;
}

const ENDPOINTS: Endpoint[] = [
  { label: 'auth/register', key: 'authRegister' },
  { label: 'auth/login', key: 'authLogin' },
  { label: 'auth/login/checkpoint', key: 'authLoginCheckpoint' },
  { label: 'auth/login/security-key', key: 'authLoginSecurityKey' },
  { label: 'auth/password/forgot', key: 'authPasswordForgot' },
  { label: 'auth/password/reset', key: 'authPasswordReset' },
  { label: 'client', key: 'client' },
  { label: 'client/servers/backups/create', key: 'clientServersBackupsCreate' },
  { label: 'client/servers/files/pull', key: 'clientServersFilesPull' },
  { label: 'client/servers/files/pull/query', key: 'clientServersFilesPullQuery' },
  { label: 'remote', key: 'remote' },
  { label: 'remote/sftp/auth', key: 'remoteSftpAuth' },
];

const DEFAULT_VALUES: RatelimitsSchema = Object.fromEntries(
  ENDPOINTS.map(({ key }) => [key, { hits: 0, windowSeconds: 0 }]),
) as RatelimitsSchema;

export default function RatelimitsContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const ratelimits = useAdminStore((state) => state.ratelimits);
  const updateSettings = useAdminStore((state) => state.updateSettings);
  const [loading, setLoading] = useState(false);

  const form = useForm<RatelimitsSchema>({
    initialValues: DEFAULT_VALUES,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsRatelimitsSchema),
  });

  useEffect(() => {
    form.setValues({
      ...ratelimits,
    });
  }, [ratelimits]);

  const doUpdate = () => {
    setLoading(true);
    updateRatelimitSettings(adminSettingsRatelimitsSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.ratelimits.page.toast.updated', {}), 'success');
        updateSettings({ ratelimits: adminSettingsRatelimitsSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.ratelimits.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2'>
          {ENDPOINTS.map(({ label, key }) => (
            <Card key={key} withBorder radius='md' p='md'>
              <Stack gap='xs'>
                <Code w='fit-content' title={label}>
                  {label}
                </Code>
                <Group grow>
                  <NumberInput
                    withAsterisk
                    label={t('pages.admin.settings.tabs.ratelimits.page.form.hits', {})}
                    description={t('pages.admin.settings.tabs.ratelimits.page.form.hitsDescription', {})}
                    key={form.key(`${key}.hits`)}
                    {...form.getInputProps(`${key}.hits`)}
                  />
                  <NumberInput
                    withAsterisk
                    label={t('pages.admin.settings.tabs.ratelimits.page.form.windowSeconds', {})}
                    description={t('pages.admin.settings.tabs.ratelimits.page.form.windowSecondsDescription', {})}
                    key={form.key(`${key}.windowSeconds`)}
                    {...form.getInputProps(`${key}.windowSeconds`)}
                  />
                </Group>
              </Stack>
            </Card>
          ))}
        </div>

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}

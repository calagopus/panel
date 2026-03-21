import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAccount from '@/api/me/account/updateAccount.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { dashboardAccountSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function AccountContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const { languages, settings } = useGlobalStore();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardAccountSchema>>({
    initialValues: {
      username: '',
      nameFirst: '',
      nameLast: '',
      language: '',
      toastPosition: 'bottom_right',
      startOnGroupedServers: true,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardAccountSchema),
  });

  useEffect(() => {
    if (user) {
      form.setValues({
        username: user.username,
        nameFirst: user.nameFirst,
        nameLast: user.nameLast,
        language: user.language,
        toastPosition: user.toastPosition,
        startOnGroupedServers: user.startOnGroupedServers,
      });
    }
  }, [user]);

  const doUpdate = () => {
    setLoading(true);

    updateAccount(form.values)
      .then(() => {
        addToast(t('pages.account.account.containers.account.toast.updated', {}), 'success');

        setUser({
          ...user!,
          ...form.values,
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.account.account.containers.account.title', {})}
      icon={<FontAwesomeIcon icon={faUser} />}
      className={classNames('h-full order-40', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Stack>
          <Group grow>
            <TextInput
              withAsterisk
              label={t('pages.account.account.containers.account.form.nameFirst', {})}
              placeholder={t('pages.account.account.containers.account.form.nameFirst', {})}
              autoComplete='given-name'
              {...form.getInputProps('nameFirst')}
            />
            <TextInput
              withAsterisk
              label={t('pages.account.account.containers.account.form.nameLast', {})}
              placeholder={t('pages.account.account.containers.account.form.nameLast', {})}
              autoComplete='family-name'
              {...form.getInputProps('nameLast')}
            />
          </Group>
          <Group grow>
            <TextInput
              withAsterisk
              label={t('pages.account.account.containers.account.form.username', {})}
              placeholder={t('pages.account.account.containers.account.form.username', {})}
              autoComplete='username'
              {...form.getInputProps('username')}
            />
            {settings.app.languageChangeEnabled && (
              <Select
                withAsterisk
                label={t('pages.account.account.containers.account.form.language', {})}
                placeholder={t('pages.account.account.containers.account.form.language', {})}
                data={languages.map((language) => ({
                  label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                  value: language,
                }))}
                {...form.getInputProps('language')}
              />
            )}
          </Group>
          <Group grow>
            <Select
              withAsterisk
              label={t('pages.account.account.containers.account.form.toastPosition', {})}
              placeholder={t('pages.account.account.containers.account.form.toastPosition', {})}
              data={[
                {
                  label: t('common.enum.userToastPosition.topLeft', {}),
                  value: 'top_left',
                },
                {
                  label: t('common.enum.userToastPosition.topCenter', {}),
                  value: 'top_center',
                },
                {
                  label: t('common.enum.userToastPosition.topRight', {}),
                  value: 'top_right',
                },
                {
                  label: t('common.enum.userToastPosition.bottomLeft', {}),
                  value: 'bottom_left',
                },
                {
                  label: t('common.enum.userToastPosition.bottomCenter', {}),
                  value: 'bottom_center',
                },
                {
                  label: t('common.enum.userToastPosition.bottomRight', {}),
                  value: 'bottom_right',
                },
              ]}
              {...form.getInputProps('toastPosition')}
            />
            <Switch
              label={t('pages.account.account.containers.account.form.startOnGroupedServers', {})}
              {...form.getInputProps('startOnGroupedServers', { type: 'checkbox' })}
            />
          </Group>
          <Group>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.update', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </TitleCard>
  );
}

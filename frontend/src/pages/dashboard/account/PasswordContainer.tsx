import { faUserLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updatePassword from '@/api/me/account/updatePassword.ts';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { dashboardPasswordSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function PasswordContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardPasswordSchema>>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardPasswordSchema),
  });

  const doUpdate = () => {
    if (!user) return;

    setLoading(true);

    updatePassword({
      password: user.hasPassword ? form.values.currentPassword : 'aaa',
      newPassword: form.values.newPassword,
    })
      .then(() => {
        if (!user.hasPassword) {
          setUser({ ...user!, hasPassword: true });
        }

        addToast(t('pages.account.account.containers.password.toast.updated', {}), 'success');
        form.reset();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  if (!user) {
    return <Spinner.Centered />;
  }

  return (
    <TitleCard
      title={t('pages.account.account.containers.password.title', {})}
      icon={<FontAwesomeIcon icon={faUserLock} />}
      className={classNames('h-full order-10', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          {user.hasPassword && (
            <PasswordInput
              withAsterisk
              label={t('pages.account.account.containers.password.form.currentPassword', {})}
              placeholder={t('pages.account.account.containers.password.form.currentPassword', {})}
              autoComplete='current-password'
              {...form.getInputProps('currentPassword')}
            />
          )}
          <PasswordInput
            withAsterisk
            label={t('pages.account.account.containers.password.form.newPassword', {})}
            placeholder={t('pages.account.account.containers.password.form.newPassword', {})}
            autoComplete='new-password'
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            withAsterisk
            label={t('pages.account.account.containers.password.form.confirmNewPassword', {})}
            placeholder={t('pages.account.account.containers.password.form.confirmNewPassword', {})}
            autoComplete='new-password'
            {...form.getInputProps('confirmNewPassword')}
          />

          <Group mt='auto'>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.update', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </TitleCard>
  );
}

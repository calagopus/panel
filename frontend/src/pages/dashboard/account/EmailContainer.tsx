import { faAt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateEmail from '@/api/me/account/updateEmail.ts';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { dashboardEmailSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function EmailContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardEmailSchema>>({
    initialValues: {
      email: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardEmailSchema),
  });

  useEffect(() => {
    if (user) {
      form.setValues({
        email: user.email,
      });
    }
  }, [user]);

  const doUpdate = () => {
    if (!user) return;

    setLoading(true);

    updateEmail({
      password: user.hasPassword ? form.values.password : 'aaa',
      email: form.values.email,
    })
      .then(() => {
        addToast(t('pages.account.account.containers.email.toast.updated', {}), 'success');

        setUser({ ...user!, email: form.values.email });
        form.setFieldValue('password', '');
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
      title={t('pages.account.account.containers.email.title', {})}
      icon={<FontAwesomeIcon icon={faAt} />}
      className={classNames('h-full order-20', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <TextInput
            withAsterisk
            label={t('pages.account.account.containers.email.form.newEmail', {})}
            placeholder={t('pages.account.account.containers.email.form.newEmail', {})}
            autoComplete='email'
            {...form.getInputProps('email')}
          />
          {user.hasPassword && (
            <PasswordInput
              withAsterisk
              label={t('pages.account.account.containers.email.form.currentPassword', {})}
              placeholder={t('pages.account.account.containers.email.form.currentPassword', {})}
              autoComplete='current-password'
              {...form.getInputProps('password')}
            />
          )}

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

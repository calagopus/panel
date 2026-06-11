import { faEnvelope, faLock, faShieldHalved, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Stack, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import register from '@/api/auth/register.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { oobeRegister } from '@/lib/schemas/oobe.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeRegister({ onNext }: OobeComponentProps) {
  const { t } = useTranslations();
  const { doLogin } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<z.infer<typeof oobeRegister>>({
    initialValues: {
      username: '',
      email: '',
      nameFirst: '',
      nameLast: '',
      password: '',
      confirmPassword: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeRegister),
  });

  const onSubmit = async () => {
    setLoading(true);

    register({
      username: form.values.username,
      email: form.values.email,
      nameFirst: form.values.nameFirst,
      nameLast: form.values.nameLast,
      password: form.values.password,
      captcha: '',
    })
      .then((response) => {
        doLogin(response.user!, false);
        onNext();
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      })
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.register.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <Alert
        icon={<FontAwesomeIcon icon={faShieldHalved} />}
        title={t('pages.oobe.register.alert.title', {})}
        color='blue'
        variant='light'
      >
        {t('pages.oobe.register.alert.description', {})}
      </Alert>

      <form onSubmit={form.onSubmit(() => onSubmit())}>
        <Stack gap='xl'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col md:flex-row gap-2 '>
              <TextInput
                label={t('common.form.firstName', {})}
                placeholder={t('pages.oobe.register.form.firstNamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faUser} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('nameFirst')}
              />
              <TextInput
                label={t('common.form.lastName', {})}
                placeholder={t('pages.oobe.register.form.lastNamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faUser} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('nameLast')}
              />
            </div>

            <div className='flex flex-col md:flex-row gap-2 '>
              <TextInput
                label={t('common.form.username', {})}
                placeholder={t('pages.oobe.register.form.usernamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faUser} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('username')}
              />
              <TextInput
                label={t('pages.oobe.register.form.email', {})}
                placeholder={t('pages.oobe.register.form.emailPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faEnvelope} size='sm' />}
                type='email'
                required
                className='flex-1'
                {...form.getInputProps('email')}
              />
            </div>

            <div className='flex flex-col md:flex-row gap-2'>
              <PasswordInput
                label={t('common.form.password', {})}
                placeholder={t('pages.oobe.register.form.passwordPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faLock} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('password')}
              />
              <PasswordInput
                label={t('common.form.confirmPassword', {})}
                placeholder={t('pages.oobe.register.form.confirmPasswordPlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faLock} size='sm' />}
                required
                className='flex-1'
                {...form.getInputProps('confirmPassword')}
              />
            </div>
          </div>

          <Button type='submit' className='md:max-w-fit md:ml-auto' disabled={!form.isValid()} loading={loading}>
            {t('pages.oobe.register.button.create', {})}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}

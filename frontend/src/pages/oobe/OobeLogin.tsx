import { faInfoCircle, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Stack, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import login from '@/api/auth/login.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { to } from '@/lib/routes.ts';
import { oobeLoginSchema } from '@/lib/schemas/oobe.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';
import { steps } from '@/routers/oobeSteps.ts';
import { useGlobalStore } from '@/stores/global.ts';

export default function OobeLogin({ onNext }: OobeComponentProps) {
  const { t } = useTranslations();
  const { doLogin } = useAuth();
  const navigate = useNavigate();
  const { settings } = useGlobalStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<z.infer<typeof oobeLoginSchema>>({
    initialValues: {
      username: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeLoginSchema),
  });

  const onSubmit = async () => {
    setLoading(true);

    login({
      user: form.values.username,
      password: form.values.password,
      captcha: '',
    })
      .then((response) => {
        if (response.type === 'two_factor_required') {
          navigate('/auth/login');
          return;
        }

        doLogin(response.user, false);

        const nextStep = steps.find((step) => step.stepKey === settings.oobeStep);
        if (nextStep) {
          navigate(to(nextStep.path, '/oobe'));
        } else {
          onNext();
        }
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      })
      .finally(() => setLoading(false));
  };

  return (
    <Stack gap='md'>
      <Title order={2}>{t('pages.oobe.login.title', {})}</Title>

      <Alert icon={<FontAwesomeIcon icon={faInfoCircle} />} color='blue' variant='light'>
        {t('pages.oobe.login.alert', {})}
      </Alert>

      {error && <AlertError error={error} setError={setError} />}

      <form onSubmit={form.onSubmit(() => onSubmit())}>
        <div className='flex flex-col gap-6'>
          <Stack gap='sm'>
            <TextInput
              label={t('common.form.username', {})}
              placeholder={t('pages.oobe.login.form.usernamePlaceholder', {})}
              leftSection={<FontAwesomeIcon icon={faUser} size='sm' />}
              required
              {...form.getInputProps('username')}
            />
            <PasswordInput
              label={t('common.form.password', {})}
              placeholder={t('pages.oobe.login.form.passwordPlaceholder', {})}
              leftSection={<FontAwesomeIcon icon={faLock} size='sm' />}
              required
              {...form.getInputProps('password')}
            />
          </Stack>
          <Button type='submit' className='min-w-fit md:w-fit md:ml-auto' disabled={!form.isValid()} loading={loading}>
            {t('pages.oobe.login.button.login', {})}
          </Button>
        </div>
      </form>
    </Stack>
  );
}

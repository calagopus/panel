import { faExclamationTriangle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Card, Divider, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import forgotPassword from '@/api/auth/forgotPassword.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { authForgotPasswordSchema } from '@/lib/schemas/auth.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AuthWrapper from './AuthWrapper.tsx';

export default function ForgotPassword() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requested, setRequested] = useState(false);
  const captchaRef = useRef<CaptchaRef>(null);

  const form = useForm<z.infer<typeof authForgotPasswordSchema>>({
    initialValues: {
      email: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authForgotPasswordSchema),
  });

  const submit = () => {
    setLoading(true);

    captchaRef.current?.getToken().then((token) => {
      forgotPassword(form.values, token)
        .then(() => {
          setSuccess(t('pages.auth.forgotPassword.success', {}));
          setRequested(true);
        })
        .catch((msg) => {
          setError(httpErrorToHuman(msg));
        })
        .finally(() => setLoading(false));
    });
  };

  return (
    <AuthWrapper>
      <div className='flex flex-col space-y-4 mb-4 w-full'>
        {error && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='red'
            title={t('common.alert.error', {})}
            onClose={() => setError('')}
            withCloseButton
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            icon={<FontAwesomeIcon icon={faInfoCircle} />}
            color='green'
            title={t('common.alert.success', {})}
            onClose={() => setSuccess('')}
            withCloseButton
          >
            {success}
          </Alert>
        )}
      </div>

      <Stack className='w-full'>
        <div>
          <Title order={2}>{t('pages.auth.forgotPassword.title', {})}</Title>
          <Text className='text-neutral-400!'>{t('pages.auth.forgotPassword.subtitle', {})}</Text>
        </div>

        <Card>
          <Stack>
            <TextInput placeholder={t('pages.auth.forgotPassword.form.email', {})} {...form.getInputProps('email')} />
            <Captcha ref={captchaRef} />

            <Button onClick={submit} loading={loading} disabled={requested || !form.isValid()} size='md' fullWidth>
              {t('pages.auth.forgotPassword.button.request', {})}
            </Button>

            <Divider label={t('common.divider.or', {})} labelPosition='center' />

            <Button variant='light' onClick={() => navigate('/auth/login')} size='md' fullWidth>
              {t('pages.auth.button.login', {})}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </AuthWrapper>
  );
}

import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Divider, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import register from '@/api/auth/register.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import Card from '@/elements/Card.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { authRegisterSchema } from '@/lib/schemas/auth.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AuthWrapper from './AuthWrapper.tsx';

export default function Register() {
  const { doLogin } = useAuth();
  const { t } = useTranslations();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const captchaRef = useRef<CaptchaRef>(null);

  const form = useForm<z.infer<typeof authRegisterSchema>>({
    initialValues: {
      username: '',
      email: '',
      nameFirst: '',
      nameLast: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authRegisterSchema),
  });

  const submit = () => {
    setLoading(true);

    captchaRef.current?.getToken().then((token) => {
      register({ ...form.values, captcha: token })
        .then((response) => {
          doLogin(response.user!);
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
      </div>

      <Stack className='w-full'>
        <div>
          <Title order={2}>{t('pages.auth.register.title', {})}</Title>
          <Text className='text-neutral-400!'>{t('pages.auth.register.subtitle', {})}</Text>
        </div>

        <Card>
          <Stack>
            <TextInput placeholder={t('common.form.username', {})} {...form.getInputProps('username')} />
            <TextInput placeholder={t('pages.auth.register.form.email', {})} {...form.getInputProps('email')} />
            <TextInput placeholder={t('pages.auth.register.form.firstName', {})} {...form.getInputProps('nameFirst')} />
            <TextInput placeholder={t('pages.auth.register.form.lastName', {})} {...form.getInputProps('nameLast')} />
            <PasswordInput placeholder={t('common.form.password', {})} {...form.getInputProps('password')} />
            <Captcha ref={captchaRef} />

            <Button onClick={submit} loading={loading} disabled={!form.isValid()} size='md' fullWidth>
              {t('pages.auth.register.button.register', {})}
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

import { faEnvelope, faExclamationTriangle, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import register from '@/api/auth/register.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Captcha, { useCaptcha } from '@/elements/Captcha.tsx';
import Card from '@/elements/Card.tsx';
import Divider from '@/elements/Divider.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { authRegisterSchema } from '@/lib/schemas/auth.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from './AuthWrapper.tsx';

export default function Register() {
  const { doLogin } = useAuth();
  const { t } = useTranslations();
  const navigate = useNavigate();
  const settings = useGlobalStore((state) => state.settings);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const captcha = useCaptcha();

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

  const submit = async () => {
    setLoading(true);
    try {
      const token = await captcha.getToken();
      const response = await register({ ...form.values, captcha: token });
      doLogin(response.user!);
    } catch (err) {
      setError(httpErrorToHuman(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.register.container}>
      <div className='flex flex-col space-y-4 mb-4 w-full'>
        {settings.app.url !== window.location.origin && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='yellow'
            title={t('common.alert.warning', {})}
          >
            {t('pages.auth.alert.urlMismatch', {
              appUrl: settings.app.url,
              currentUrl: window.location.origin,
            }).md()}
          </Alert>
        )}
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
            <TextInput
              label={t('common.form.username', {})}
              placeholder={t('pages.auth.register.form.usernamePlaceholder', {})}
              autoComplete='username'
              leftSection={<FontAwesomeIcon icon={faUser} />}
              size='md'
              autoFocus
              {...form.getInputProps('username')}
            />
            <TextInput
              label={t('common.form.email', {})}
              placeholder={t('pages.auth.register.form.emailPlaceholder', {})}
              autoComplete='email'
              leftSection={<FontAwesomeIcon icon={faEnvelope} />}
              size='md'
              {...form.getInputProps('email')}
            />
            <TextInput
              label={t('common.form.firstName', {})}
              placeholder={t('pages.auth.register.form.firstNamePlaceholder', {})}
              autoComplete='given-name'
              leftSection={<FontAwesomeIcon icon={faUser} />}
              size='md'
              {...form.getInputProps('nameFirst')}
            />
            <TextInput
              label={t('common.form.lastName', {})}
              placeholder={t('pages.auth.register.form.lastNamePlaceholder', {})}
              autoComplete='family-name'
              leftSection={<FontAwesomeIcon icon={faUser} />}
              size='md'
              {...form.getInputProps('nameLast')}
            />
            <PasswordInput
              label={t('common.form.password', {})}
              placeholder={t('pages.auth.register.form.passwordPlaceholder', {})}
              autoComplete='new-password'
              onKeyDown={(e) => e.key === 'Enter' && form.isValid() && captcha.isValid && submit()}
              leftSection={<FontAwesomeIcon icon={faLock} />}
              size='md'
              {...form.getInputProps('password')}
            />

            <Button
              onClick={submit}
              loading={loading}
              disabled={!form.isValid() || !captcha.isValid}
              size='md'
              fullWidth
            >
              {t('pages.auth.register.button.register', {})}
            </Button>

            <Divider label={t('common.divider.or', {})} labelPosition='center' />

            <Button variant='light' onClick={() => navigate('/auth/login')} size='md' fullWidth>
              {t('pages.auth.button.login', {})}
            </Button>
          </Stack>
        </Card>
        <Captcha {...captcha.props} />
      </Stack>
    </AuthWrapper>
  );
}

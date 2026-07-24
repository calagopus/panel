import { faExclamationTriangle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import forgotPassword from '@/api/auth/forgotPassword.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import Card from '@/elements/Card.tsx';
import Divider from '@/elements/Divider.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { authForgotPasswordSchema } from '@/lib/schemas/auth.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from './AuthWrapper.tsx';

export default function ForgotPassword() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const settings = useGlobalStore((state) => state.settings);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requested, setRequested] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
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
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.forgotPassword.container}>
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
            <TextInput placeholder={t('common.form.email', {})} {...form.getInputProps('email')} />

            <Button
              onClick={submit}
              loading={loading}
              disabled={requested || !form.isValid() || !isCaptchaValid}
              size='md'
              fullWidth
            >
              {t('pages.auth.forgotPassword.button.request', {})}
            </Button>

            <Divider label={t('common.divider.or', {})} labelPosition='center' />

            <Button variant='light' onClick={() => navigate('/auth/login')} size='md' fullWidth>
              {t('pages.auth.button.login', {})}
            </Button>
          </Stack>
        </Card>
        <Captcha ref={captchaRef} onValidChange={setIsCaptchaValid} />
      </Stack>
    </AuthWrapper>
  );
}

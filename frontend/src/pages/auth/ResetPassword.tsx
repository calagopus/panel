import { faExclamationTriangle, faLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import resetPassword from '@/api/auth/resetPassword.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { authResetPasswordSchema } from '@/lib/schemas/auth.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AuthWrapper from './AuthWrapper.tsx';

export default function ResetPassword() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = searchParams.get('token');

  const form = useForm<z.infer<typeof authResetPasswordSchema>>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authResetPasswordSchema),
  });

  useEffect(() => {
    if (!token) {
      navigate('/auth/login');
    }
  }, []);

  const submit = () => {
    setLoading(true);

    resetPassword(token!, form.values)
      .then(() => {
        addToast(t('pages.auth.resetPassword.toast.success', {}), 'success');
        navigate('/auth/login');
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      })
      .finally(() => setLoading(false));
  };

  return (
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.resetPassword.container}>
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
          <Title order={2}>{t('pages.auth.resetPassword.title', {})}</Title>
          <Text className='text-neutral-400!'>{t('pages.auth.resetPassword.subtitle', {})}</Text>
        </div>
        <Card>
          <Stack>
            <PasswordInput
              label={t('common.form.password', {})}
              placeholder={t('pages.auth.resetPassword.form.passwordPlaceholder', {})}
              autoComplete='new-password'
              leftSection={<FontAwesomeIcon icon={faLock} />}
              size='md'
              autoFocus
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label={t('common.form.confirmPassword', {})}
              placeholder={t('pages.auth.resetPassword.form.confirmPasswordPlaceholder', {})}
              autoComplete='new-password'
              leftSection={<FontAwesomeIcon icon={faLock} />}
              size='md'
              {...form.getInputProps('confirmPassword')}
            />

            <Button onClick={submit} loading={loading} disabled={!token || !form.isValid()} size='md' fullWidth>
              {t('pages.auth.resetPassword.button.reset', {})}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </AuthWrapper>
  );
}

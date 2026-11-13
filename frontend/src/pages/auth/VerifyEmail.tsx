import { faCircleCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import verifyEmail from '@/api/auth/verifyEmail.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import resendEmailVerification from '@/api/me/account/resendEmailVerification.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Center from '@/elements/layout/Center.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AuthWrapper from './AuthWrapper.tsx';

export default function VerifyEmail() {
  const { t } = useTranslations();
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      navigate('/auth/login');
      return;
    }

    verifyEmail(token)
      .then((response) => {
        setEmail(response.email);

        if (user && user.uuid === response.userUuid) {
          setUser({ ...user, email: response.email, emailVerified: true });
        }
      })
      .catch((msg) => setError(httpErrorToHuman(msg)))
      .finally(() => setLoading(false));
  }, []);

  const doResendVerification = () => {
    setResending(true);

    resendEmailVerification()
      .then(({ email }) => addToast(t('pages.account.account.alert.verifyEmail.sent', { email }), 'success'))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setResending(false));
  };

  return (
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.verifyEmail.container}>
      <div className='flex flex-col space-y-4 mb-4 w-full'>
        {error && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='red'
            title={t('common.alert.error', {})}
          >
            {error}
          </Alert>
        )}
      </div>

      <Stack className='w-full'>
        <Title order={2}>{t('pages.auth.verifyEmail.title', {})}</Title>
        <Card>
          <Stack>
            {loading ? (
              <Center>
                <Spinner />
              </Center>
            ) : error ? (
              <>
                <Text c='dimmed'>{t('pages.auth.verifyEmail.failed', {})}</Text>
                {user && !user.emailVerified && (
                  <Button onClick={doResendVerification} loading={resending} size='md' fullWidth>
                    {t('pages.account.account.alert.verifyEmail.button.resend', {})}
                  </Button>
                )}
                <Button
                  variant={user && !user.emailVerified ? 'light' : undefined}
                  onClick={() => navigate(user ? '/account' : '/auth/login')}
                  size='md'
                  fullWidth
                >
                  {user ? t('pages.auth.verifyEmail.button.continue', {}) : t('pages.auth.button.login', {})}
                </Button>
              </>
            ) : (
              <>
                <Center>
                  <FontAwesomeIcon icon={faCircleCheck} className='text-(--mantine-color-green-text)' size='3x' />
                </Center>
                <Text c='dimmed' className='text-center'>
                  {t('pages.auth.verifyEmail.success', { email }).md()}
                </Text>
                <Button onClick={() => navigate(user ? '/' : '/auth/login')} size='md' fullWidth>
                  {user ? t('pages.auth.verifyEmail.button.continue', {}) : t('pages.auth.button.login', {})}
                </Button>
              </>
            )}
          </Stack>
        </Card>
      </Stack>
    </AuthWrapper>
  );
}

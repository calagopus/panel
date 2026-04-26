import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Center, Divider, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import checkpointLogin from '@/api/auth/checkpointLogin.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import PinInput from '@/elements/input/PinInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { authTotpSchema } from '@/lib/schemas/auth.ts';
import { userSchema } from '@/lib/schemas/user.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from '../AuthWrapper.tsx';

interface TwoFactorInformation {
  user: z.infer<typeof userSchema>;
  token: string;
}

export default function LoginCheckpoint() {
  const { doLogin } = useAuth();
  const { timeOffset } = useGlobalStore();
  const { t } = useTranslations();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'totp' | 'totp-recovery'>('totp');
  const [twoFactorInformation, setTwoFactorInformation] = useState<TwoFactorInformation | null>(null);

  useEffect(() => {
    const data = params.get('data');
    if (data) {
      try {
        const parsed = JSON.parse(atob(data.replaceAll('-', '+').replaceAll('_', '/')));
        setTwoFactorInformation(parsed);
      } catch (err) {
        console.error('Failed to parse checkpoint data', err);
        navigate('/login');
      }
    }
  }, [params, navigate]);

  const form = useForm({
    initialValues: {
      code: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authTotpSchema),
  });

  const doSubmit = () => {
    setLoading(true);

    checkpointLogin({
      code: form.values.code,
      confirmation_token: twoFactorInformation?.token ?? '',
    })
      .then((response) => {
        doLogin(response.user);
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      })
      .finally(() => setLoading(false));
  };

  return (
    <AuthWrapper>
      <div className='flex flex-col space-y-4 mb-4 w-full'>
        {(timeOffset > 5000 || timeOffset < -5000) && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='yellow'
            title={t('common.alert.warning', {})}
          >
            {t('common.alert.clockOffset', { offset: String(Math.round(timeOffset / 1000)) })}
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
        {step === 'totp' ? (
          <>
            <Title order={2}>{t('pages.auth.login.step.totp.title', {})}</Title>
            <Card>
              <Stack>
                <div className='flex items-center gap-2'>
                  <img
                    src={twoFactorInformation?.user.avatar ?? '/icon.svg'}
                    alt={twoFactorInformation?.user.username}
                    className='size-14 rounded-full'
                  />
                  <span className='text-neutral-400'>
                    {t('pages.auth.login.step.totp.welcomeBack', {
                      username: twoFactorInformation?.user.username ?? '',
                    })}
                  </span>
                </div>
                <Text className=' text-neutral-400!'>{t('pages.auth.login.step.totp.enterCode', {})}</Text>
                <Center>
                  <PinInput
                    length={6}
                    placeholder='0'
                    size='md'
                    type='number'
                    oneTimeCode
                    autoFocus
                    {...form.getInputProps('code')}
                  />
                </Center>
                <Button onClick={doSubmit} loading={loading} disabled={!form.isValid()} size='md' fullWidth>
                  {t('pages.auth.login.step.totp.button.verify', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button
                  variant='light'
                  onClick={() => {
                    form.reset();
                    setStep('totp-recovery');
                  }}
                  size='md'
                  fullWidth
                >
                  {t('pages.auth.login.step.totp.button.useRecoveryCode', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : step === 'totp-recovery' ? (
          <>
            <div>
              <Title order={2}>{t('pages.auth.login.step.totp.title', {})}</Title>
              <Text className='text-neutral-400!'>{t('pages.auth.login.step.totpRecovery.subtitle', {})}</Text>
            </div>
            <Card>
              <Stack>
                <TextInput
                  label={t('pages.auth.login.step.totpRecovery.form.label', {})}
                  placeholder={t('pages.auth.login.step.totpRecovery.form.placeholder', {})}
                  onKeyDown={(e) => e.key === 'Enter' && doSubmit()}
                  size='md'
                  autoFocus
                  {...form.getInputProps('code')}
                />
                <Button onClick={doSubmit} loading={loading} disabled={!form.isValid()} size='md' fullWidth>
                  {t('pages.auth.login.step.totp.button.verify', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button
                  variant='light'
                  onClick={() => {
                    form.reset();
                    setStep('totp');
                  }}
                  size='md'
                  fullWidth
                >
                  {t('pages.auth.login.step.totp.button.useTotp', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : null}
      </Stack>
    </AuthWrapper>
  );
}

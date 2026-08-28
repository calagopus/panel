import { faExclamationTriangle, faKey } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import checkpointLogin from '@/api/auth/checkpointLogin.ts';
import sendCheckpointEmailCode from '@/api/auth/sendCheckpointEmailCode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Avatar from '@/elements/Avatar.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Center from '@/elements/Center.tsx';
import Divider from '@/elements/Divider.tsx';
import PinInput from '@/elements/input/PinInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { authTotpSchema } from '@/lib/schemas/auth.ts';
import { type twoFactorMethod, userSchema } from '@/lib/schemas/user.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from '../AuthWrapper.tsx';

interface TwoFactorInformation {
  user: z.infer<typeof userSchema>;
  token: string;
  methods: z.infer<typeof twoFactorMethod>[];
}

export default function LoginCheckpoint() {
  const { doLogin } = useAuth();
  const settings = useGlobalStore((state) => state.settings);
  const timeOffset = useGlobalStore((state) => state.timeOffset);
  const { t } = useTranslations();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'totp' | 'totp-recovery' | 'email'>('totp');
  const [twoFactorInformation, setTwoFactorInformation] = useState<TwoFactorInformation | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const methods = twoFactorInformation?.methods ?? ['totp'];
  const hasTotp = methods.includes('totp');
  const hasEmail = methods.includes('email');

  useEffect(() => {
    const data = params.get('data');
    if (data) {
      try {
        const parsed: TwoFactorInformation = JSON.parse(atob(data.replaceAll('-', '+').replaceAll('_', '/')));
        setTwoFactorInformation(parsed);
        if (parsed.methods && !parsed.methods.includes('totp') && parsed.methods.includes('email')) {
          setStep('email');
        }
      } catch (err) {
        console.error('Failed to parse checkpoint data', err);
        navigate('/login');
      }
    }
  }, [params, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const form = useForm({
    initialValues: {
      code: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authTotpSchema),
  });

  const doSendCode = () => {
    setSendingCode(true);
    setError('');

    sendCheckpointEmailCode({ confirmation_token: twoFactorInformation?.token ?? '' })
      .then(() => {
        setCodeSent(true);
        setResendCooldown(60);
      })
      .catch((msg) => setError(httpErrorToHuman(msg)))
      .finally(() => setSendingCode(false));
  };

  const doSubmit = () => {
    setLoading(true);

    checkpointLogin({
      code: form.values.code,
      method: step === 'totp-recovery' ? undefined : step,
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
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.checkpoint.container}>
      <div className='flex flex-col space-y-4 mb-4 w-full'>
        {Math.abs(timeOffset) > 5000 && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            color='yellow'
            title={t('common.alert.warning', {})}
          >
            {t('common.alert.clockOffset', {
              offset: String(Math.round(timeOffset / 1000)),
            })}
          </Alert>
        )}
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
        {step === 'totp' ? (
          <>
            <Title order={2}>{t('pages.auth.login.step.totp.title', {})}</Title>
            <Card>
              <Stack>
                <div className='flex items-center gap-2'>
                  <Avatar
                    size={56}
                    src={twoFactorInformation?.user.avatar}
                    name={twoFactorInformation?.user.username}
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
                {hasEmail && (
                  <Button
                    variant='light'
                    onClick={() => {
                      form.reset();
                      setStep('email');
                    }}
                    size='md'
                    fullWidth
                  >
                    {t('pages.auth.login.step.email.button.useEmail', {})}
                  </Button>
                )}
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
                  leftSection={<FontAwesomeIcon icon={faKey} />}
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
                    setStep(hasTotp ? 'totp' : 'email');
                  }}
                  size='md'
                  fullWidth
                >
                  {hasTotp
                    ? t('pages.auth.login.step.totp.button.useTotp', {})
                    : t('pages.auth.login.step.email.button.useEmail', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : step === 'email' ? (
          <>
            <Title order={2}>{t('pages.auth.login.step.totp.title', {})}</Title>
            <Card>
              <Stack>
                <div className='flex items-center gap-2'>
                  <Avatar
                    size={56}
                    src={twoFactorInformation?.user.avatar}
                    name={twoFactorInformation?.user.username}
                  />
                  <span className='text-neutral-400'>
                    {t('pages.auth.login.step.totp.welcomeBack', {
                      username: twoFactorInformation?.user.username ?? '',
                    })}
                  </span>
                </div>
                {codeSent ? (
                  <>
                    <Text className='text-neutral-400!'>{t('pages.auth.login.step.email.enterCode', {})}</Text>
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
                    <Button
                      variant='subtle'
                      onClick={doSendCode}
                      loading={sendingCode}
                      disabled={resendCooldown > 0}
                      size='md'
                      fullWidth
                    >
                      {resendCooldown > 0
                        ? t('pages.auth.login.step.email.button.resendIn', {
                            seconds: String(resendCooldown),
                          })
                        : t('pages.auth.login.step.email.button.resend', {})}
                    </Button>
                  </>
                ) : (
                  <>
                    <Text className='text-neutral-400!'>{t('pages.auth.login.step.email.subtitle', {})}</Text>
                    <Button onClick={doSendCode} loading={sendingCode} size='md' fullWidth>
                      {t('pages.auth.login.step.email.button.sendCode', {})}
                    </Button>
                  </>
                )}
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                {hasTotp && (
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
                )}
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
        ) : null}
      </Stack>
    </AuthWrapper>
  );
}

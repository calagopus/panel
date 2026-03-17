import { faExclamationTriangle, faFingerprint, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Center, Divider, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { startTransition, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { z } from 'zod';
import checkpointLogin from '@/api/auth/checkpointLogin.ts';
import getOAuthProviders from '@/api/auth/getOAuthProviders.ts';
import getSecurityKeys from '@/api/auth/getSecurityKeys.ts';
import login from '@/api/auth/login.ts';
import postSecurityKeyChallenge from '@/api/auth/postSecurityKeyChallenge.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import Card from '@/elements/Card.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import PinInput from '@/elements/input/PinInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { authPasswordSchema, authTotpSchema, authUsernameSchema } from '@/lib/schemas/auth.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { userSchema } from '@/lib/schemas/user.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from './AuthWrapper.tsx';

interface TwoFactorInformation {
  user: z.infer<typeof userSchema>;
  token: string;
}

export default function Login() {
  const { doLogin } = useAuth();
  const { settings } = useGlobalStore();
  const { t } = useTranslations();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'username' | 'passkey' | 'password' | 'totp' | 'totp-recovery'>('username');
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);
  const [passkeyUuid, setPasskeyUuid] = useState('');
  const [passkeyOptions, setPasskeyOptions] = useState<CredentialRequestOptions>();
  const [twoFactorInformation, setTwoFactorInformation] = useState<TwoFactorInformation | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const captchaRef = useRef<CaptchaRef>(null);

  const usernameForm = useForm({
    initialValues: {
      username: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authUsernameSchema),
  });

  const passwordForm = useForm({
    initialValues: {
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authPasswordSchema),
  });

  const totpForm = useForm({
    initialValues: {
      code: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(authTotpSchema),
  });

  useEffect(() => {
    getOAuthProviders().then((oAuthProviders) => {
      setOAuthProviders(oAuthProviders);
    });
  }, []);

  const doSubmitUsername = () => {
    if (!usernameForm.values.username) {
      setError(t('pages.auth.login.error.usernameRequired', {}));
      return;
    }

    setLoading(true);
    setError('');

    getSecurityKeys(usernameForm.values.username)
      .then((keys) => {
        setTimeOffset(Date.now() - keys.serverTime.getTime());

        if (keys.options.publicKey?.allowCredentials?.length === 0) {
          setStep('password');
        } else {
          startTransition(() => {
            setPasskeyUuid(keys.uuid);
            setPasskeyOptions(keys.options);
            setStep('passkey');
          });
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  const doPasskeyAuth = () => {
    setLoading(true);

    if (!window.navigator.credentials) {
      setError(t('pages.auth.login.passkey.error.notSupported', {}));
      return;
    }

    window.navigator.credentials
      .get(passkeyOptions)
      .then((credential) => {
        postSecurityKeyChallenge(passkeyUuid, credential as PublicKeyCredential)
          .then((response) => {
            doLogin(response.user);
          })
          .catch((msg) => {
            setError(httpErrorToHuman(msg));
          });
      })
      .catch((err: DOMException) => {
        let message = t('pages.auth.login.passkey.error.unexpected', {});

        switch (err.name) {
          case 'AbortError':
            message = t('pages.auth.login.passkey.error.cancelled', {});
            break;
          case 'NotAllowedError':
            message = t('pages.auth.login.passkey.error.dismissed', {});
            break;
          case 'InvalidStateError':
            message = t('pages.auth.login.passkey.error.invalidState', {});
            break;
          case 'NotSupportedError':
            message = t('pages.auth.login.passkey.error.notSupportedType', {});
            break;
          case 'SecurityError':
            message = t('pages.auth.login.passkey.error.securityError', {});
            break;
          case 'UnknownError':
            message = t('pages.auth.login.passkey.error.authenticatorError', {});
            break;
          case 'ConstraintError':
            message = t('pages.auth.login.passkey.error.constraintError', {});
            break;
          default:
            message = `${err.name}: ${err.message}`;
            break;
        }

        setError(message);
      })
      .finally(() => setLoading(false));
  };

  const doSubmitPassword = () => {
    setLoading(true);

    captchaRef.current?.getToken().then((token) => {
      login({
        user: usernameForm.values.username,
        password: passwordForm.values.password,
        captcha: token,
      })
        .then((response) => {
          if (response.type === 'two_factor_required') {
            startTransition(() => {
              setTwoFactorInformation({ user: response.user, token: response.token });
              setStep('totp');
            });
            return;
          }

          doLogin(response.user);
        })
        .catch((msg) => {
          setError(httpErrorToHuman(msg));
          captchaRef.current?.resetCaptcha();
        })
        .finally(() => setLoading(false));
    });
  };

  const doSubmitTotp = () => {
    setLoading(true);

    checkpointLogin({
      code: totpForm.values.code,
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
            {t('pages.auth.login.alert.clockOffset', { offset: String(Math.round(timeOffset / 1000)) })}
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
        {step === 'username' ? (
          <>
            <div>
              <Title order={2}>{t('pages.auth.login.step.username.title', {})}</Title>
              <Text className='text-neutral-400!'>{t('pages.auth.login.step.username.subtitle', {})}</Text>
            </div>
            <Card>
              <Stack>
                <div className='flex flex-col gap-1'>
                  <TextInput
                    label={t('common.form.username', {})}
                    placeholder={t('pages.auth.login.step.username.form.usernamePlaceholder', {})}
                    autoComplete='username'
                    onKeyDown={(e) => e.key === 'Enter' && doSubmitUsername()}
                    leftSection={<FontAwesomeIcon icon={faUser} />}
                    size='md'
                    autoFocus
                    {...usernameForm.getInputProps('username')}
                  />
                  <NavLink className='text-neutral-400' to='/auth/forgot-password'>
                    {t('pages.auth.login.step.username.link.forgotPassword', {})}
                  </NavLink>
                </div>
                <Button
                  onClick={doSubmitUsername}
                  disabled={!usernameForm.isValid()}
                  loading={loading}
                  size='md'
                  fullWidth
                >
                  {t('common.button.continue', {})}
                </Button>
                <Divider
                  label={t('common.divider.or', {})}
                  labelPosition='center'
                  hidden={oAuthProviders.length === 0 && !settings.app.registrationEnabled}
                />
                {oAuthProviders.length > 3 ? (
                  <Button
                    variant='light'
                    disabled={!oAuthProviders.length}
                    onClick={() => navigate('/auth/login/oauth')}
                    size='md'
                    fullWidth
                  >
                    {t('pages.auth.login.step.username.button.oauthLogin', {})}
                  </Button>
                ) : (
                  oAuthProviders.length > 0 && (
                    <>
                      {oAuthProviders.map((oAuthProvider) => (
                        <a key={oAuthProvider.uuid} href={`/api/auth/oauth/redirect/${oAuthProvider.uuid}`}>
                          <Button leftSection={<FontAwesomeIcon icon={faFingerprint} />} size='md' fullWidth>
                            {t('pages.auth.button.loginWith', { name: oAuthProvider.name })}
                          </Button>
                        </a>
                      ))}
                    </>
                  )
                )}
                {settings.app.registrationEnabled && (
                  <NavLink to='/auth/register' className='text-neutral-400 flex gap-1 items-center'>
                    {t('pages.auth.login.step.username.link.notRegistered', {})}{' '}
                    <p>{t('pages.auth.login.step.username.link.createAccount', {})}</p>
                  </NavLink>
                )}
              </Stack>
            </Card>
          </>
        ) : step === 'passkey' ? (
          <>
            <div>
              <Title order={2}>{t('pages.auth.login.step.passkey.title', {})}</Title>
              <Text className='text-neutral-400!'>
                {t('pages.auth.login.step.passkey.subtitle', { username: usernameForm.values.username })}
              </Text>
            </div>
            <Card>
              <Stack>
                <Button
                  onClick={doPasskeyAuth}
                  loading={loading}
                  leftSection={<FontAwesomeIcon icon={faFingerprint} />}
                  size='md'
                  fullWidth
                >
                  {t('pages.auth.login.step.passkey.button.usePasskey', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button variant='light' onClick={() => setStep('password')} size='md' fullWidth>
                  {t('pages.auth.login.step.passkey.button.usePassword', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : step === 'password' ? (
          <>
            <div>
              <Title order={2}>{t('pages.auth.login.step.password.title', {})}</Title>
              <Text className='text-neutral-400!'>
                {t('pages.auth.login.step.password.subtitle', { username: usernameForm.values.username })}
              </Text>
            </div>
            <Card>
              <Stack>
                <PasswordInput
                  label={t('common.form.password', {})}
                  placeholder={t('pages.auth.login.step.password.form.passwordPlaceholder', {})}
                  autoComplete='current-password'
                  onKeyDown={(e) => e.key === 'Enter' && doSubmitPassword()}
                  size='md'
                  autoFocus
                  {...passwordForm.getInputProps('password')}
                />
                <Captcha ref={captchaRef} />
                <Button
                  onClick={doSubmitPassword}
                  disabled={!passwordForm.isValid()}
                  loading={loading}
                  size='md'
                  fullWidth
                >
                  {t('pages.auth.login.step.password.button.signIn', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button variant='light' onClick={() => navigate('/auth/forgot-password')} size='md' fullWidth>
                  {t('pages.auth.login.step.password.button.forgotPassword', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : step === 'totp' ? (
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
                    {...totpForm.getInputProps('code')}
                  />
                </Center>
                <Button onClick={doSubmitTotp} loading={loading} disabled={!totpForm.isValid()} size='md' fullWidth>
                  {t('pages.auth.login.step.totp.button.verify', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button
                  variant='light'
                  onClick={() => {
                    totpForm.reset();
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
                  onKeyDown={(e) => e.key === 'Enter' && doSubmitTotp()}
                  size='md'
                  autoFocus
                  {...totpForm.getInputProps('code')}
                />
                <Button onClick={doSubmitTotp} loading={loading} disabled={!totpForm.isValid()} size='md' fullWidth>
                  {t('pages.auth.login.step.totp.button.verify', {})}
                </Button>
                <Divider label={t('common.divider.or', {})} labelPosition='center' />
                <Button
                  variant='light'
                  onClick={() => {
                    totpForm.reset();
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

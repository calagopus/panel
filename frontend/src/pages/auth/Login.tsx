import { faExclamationTriangle, faFingerprint, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Alert, Divider, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { startTransition, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import getOAuthProviders from '@/api/auth/getOAuthProviders.ts';
import getSecurityKeys from '@/api/auth/getSecurityKeys.ts';
import login from '@/api/auth/login.ts';
import postSecurityKeyChallenge from '@/api/auth/postSecurityKeyChallenge.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import Card from '@/elements/Card.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { authPasswordSchema, authUsernameSchema } from '@/lib/schemas/auth.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from './AuthWrapper.tsx';

export default function Login() {
  const { doLogin } = useAuth();
  const { settings, timeOffset } = useGlobalStore();
  const { t } = useTranslations();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'username' | 'passkey' | 'password'>('username');
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);
  const [passkeyUuid, setPasskeyUuid] = useState('');
  const [passkeyOptions, setPasskeyOptions] = useState<CredentialRequestOptions>();
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

  useEffect(() => {
    getOAuthProviders().then((oAuthProviders) => {
      setOAuthProviders(oAuthProviders);
    });
  }, []);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      switch (error) {
        case 'registration_disabled':
          setError(t('pages.auth.login.error.registrationDisabled', {}));
          break;
        case 'user_already_exists':
          setError(t('pages.auth.login.error.userAlreadyExists', {}));
          break;
      }

      searchParams.delete('error');
      setSearchParams(searchParams);
    }
  }, [searchParams]);

  const doSubmitUsername = () => {
    if (!usernameForm.values.username) {
      setError(t('pages.auth.login.error.usernameRequired', {}));
      return;
    }

    setLoading(true);
    setError('');

    getSecurityKeys(usernameForm.values.username)
      .then((keys) => {
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
            const authInfo = btoa(
              JSON.stringify({
                user: response.user,
                token: response.token,
              }),
            )
              .replaceAll('+', '-')
              .replaceAll('/', '_');

            navigate(`/auth/login/checkpoint?data=${authInfo}`);

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

  return (
    <AuthWrapper>
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
                            {t('pages.auth.button.loginWith', {
                              name: oAuthProvider.name,
                            })}
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
                {t('pages.auth.login.step.passkey.subtitle', {
                  username: usernameForm.values.username,
                })}
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
                {t('pages.auth.login.step.password.subtitle', {
                  username: usernameForm.values.username,
                })}
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
        ) : null}
      </Stack>
    </AuthWrapper>
  );
}

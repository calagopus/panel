import { faExclamationTriangle, faFingerprint, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { startTransition, useEffect, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import getDiscoverableSecurityKeyChallenge from '@/api/auth/getDiscoverableSecurityKeyChallenge.ts';
import getOAuthProviders from '@/api/auth/getOAuthProviders.ts';
import getSecurityKeys from '@/api/auth/getSecurityKeys.ts';
import login from '@/api/auth/login.ts';
import postDiscoverableSecurityKeyChallenge from '@/api/auth/postDiscoverableSecurityKeyChallenge.ts';
import postSecurityKeyChallenge from '@/api/auth/postSecurityKeyChallenge.ts';
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
import { authPasswordSchema, authUsernameSchema } from '@/lib/schemas/auth.ts';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import AuthWrapper from './AuthWrapper.tsx';

export default function Login() {
  const { doLogin } = useAuth();
  const settings = useGlobalStore((state) => state.settings);
  const timeOffset = useGlobalStore((state) => state.timeOffset);
  const { t } = useTranslations();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'username' | 'passkey' | 'password'>('username');
  const [oAuthProviders, setOAuthProviders] = useState<z.infer<typeof oAuthProviderSchema>[]>([]);
  const [passkeyUuid, setPasskeyUuid] = useState('');
  const [passkeyOptions, setPasskeyOptions] = useState<CredentialRequestOptions>();
  const captcha = useCaptcha();

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

    if (settings.webauthn?.enabled === false) {
      setStep('password');
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

  const runPasskeyAuth = (
    getChallenge: () => Promise<{ uuid: string; options?: CredentialRequestOptions }>,
    submit: (uuid: string, credential: PublicKeyCredential) => Promise<{ user: Parameters<typeof doLogin>[0] }>,
    dismissedMessage: string,
  ) => {
    if (!window.navigator.credentials) {
      setError(t('pages.auth.login.passkey.error.notSupported', {}));
      return;
    }

    setLoading(true);
    setError('');

    getChallenge()
      .then(({ uuid, options }) =>
        window.navigator.credentials.get(options).then((credential) =>
          submit(uuid, credential as PublicKeyCredential).then((response) => {
            doLogin(response.user);
          }),
        ),
      )
      .catch((err) => {
        if (!(err instanceof DOMException)) {
          setError(httpErrorToHuman(err));
          return;
        }

        let message = t('pages.auth.login.passkey.error.unexpected', {});

        switch (err.name) {
          case 'AbortError':
            message = t('pages.auth.login.passkey.error.cancelled', {});
            break;
          case 'NotAllowedError':
            message = dismissedMessage;
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

  const doPasskeyAuth = () =>
    runPasskeyAuth(
      () => Promise.resolve({ uuid: passkeyUuid, options: passkeyOptions }),
      postSecurityKeyChallenge,
      t('pages.auth.login.passkey.error.dismissed', {}),
    );

  const doDiscoverablePasskeyAuth = () =>
    runPasskeyAuth(
      getDiscoverableSecurityKeyChallenge,
      postDiscoverableSecurityKeyChallenge,
      t('pages.auth.login.passkey.error.noUsernamelessKey', {}),
    );

  const doSubmitPassword = async () => {
    setLoading(true);
    try {
      const token = await captcha.getToken();
      const response = await login({
        user: usernameForm.values.username,
        password: passwordForm.values.password,
        captcha: token,
      });

      if (response.type === 'two_factor_required') {
        const authInfo = btoa(
          JSON.stringify({
            user: response.user,
            token: response.token,
            methods: response.methods,
          }),
        )
          .replaceAll('+', '-')
          .replaceAll('/', '_');

        navigate(`/auth/login/checkpoint?data=${authInfo}`);
      } else {
        doLogin(response.user);
      }
    } catch (err) {
      setError(httpErrorToHuman(err));
    }
    setLoading(false);
  };

  return (
    <AuthWrapper registry={window.extensionContext.extensionRegistry.pages.auth.login.container}>
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
                    label={t('common.form.usernameOrEmail', {})}
                    placeholder={t('pages.auth.login.step.username.form.usernameOrEmailPlaceholder', {})}
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

                {(oAuthProviders.length > 0 ||
                  (settings.webauthn?.enabled !== false && settings.webauthn?.allowDiscoverable !== false)) && (
                  <Divider label={t('common.divider.or', {})} labelPosition='center' />
                )}

                {settings.webauthn?.enabled !== false && settings.webauthn?.allowDiscoverable !== false && (
                  <Button
                    variant='light'
                    onClick={doDiscoverablePasskeyAuth}
                    loading={loading}
                    leftSection={<FontAwesomeIcon icon={faFingerprint} />}
                    size='md'
                    fullWidth
                  >
                    {t('pages.auth.login.step.username.button.passkeyLogin', {})}
                  </Button>
                )}

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
                        <Button
                          key={oAuthProvider.uuid}
                          leftSection={<FontAwesomeIcon icon={faFingerprint} />}
                          size='md'
                          fullWidth
                          onClick={() => {
                            window.location.href = `/api/auth/oauth/redirect/${oAuthProvider.uuid}`;
                          }}
                        >
                          {t('pages.auth.button.loginWith', {
                            name: oAuthProvider.name,
                          })}
                        </Button>
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
                <Button variant='light' onClick={() => setStep('username')} size='md' fullWidth>
                  {t('common.button.back', {})}
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
                  leftSection={<FontAwesomeIcon icon={faLock} />}
                  size='md'
                  autoFocus
                  {...passwordForm.getInputProps('password')}
                />
                <Button
                  onClick={doSubmitPassword}
                  disabled={!passwordForm.isValid() || !captcha.isValid}
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
                <Button variant='light' onClick={() => setStep('username')} size='md' fullWidth>
                  {t('common.button.back', {})}
                </Button>
              </Stack>
            </Card>
          </>
        ) : null}
        <Captcha {...captcha.props} />
      </Stack>
    </AuthWrapper>
  );
}

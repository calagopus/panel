import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Modal as MantineModal, Stack, Text, useModalsStack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import enableTwoFactor from '@/api/me/account/enableTwoFactor.ts';
import getTwoFactor from '@/api/me/account/getTwoFactor.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { dashboardTwoFactorEnableSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export interface TwoFactorSetupResponse {
  otpUrl: string;
  secret: string;
}

export default function TwoFactorSetupButton() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const { timeOffset } = useGlobalStore();

  const stageStack = useModalsStack(['setup', 'recovery']);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [token, setToken] = useState<TwoFactorSetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardTwoFactorEnableSchema>>({
    initialValues: {
      code: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardTwoFactorEnableSchema),
  });

  useEffect(() => {
    if (!open) {
      stageStack.open('setup');
      setRecoveryCodes([]);
      form.reset();
      return;
    }

    getTwoFactor()
      .then((res) => {
        setToken(res);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, [open]);

  const setCanvasRef = useCallback(
    (node: HTMLCanvasElement) => {
      canvasRef.current = node;

      if (!node || !token?.otpUrl) return;
      QRCode.toCanvas(node, token.otpUrl);
    },
    [token],
  );

  const doEnable = () => {
    setLoading(true);

    enableTwoFactor(form.values)
      .then(({ recoveryCodes }) => {
        setRecoveryCodes(recoveryCodes);
        addToast(t('pages.account.account.containers.twoFactor.toast.enabled', {}), 'warning');
        stageStack.open('recovery');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <MantineModal.Stack>
        <Modal
          {...stageStack.register('setup')}
          title={t('pages.account.account.containers.twoFactor.modal.setupTwoFactor.title', {})}
        >
          {(timeOffset > 5000 || timeOffset < -5000) && (
            <Alert
              icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
              color='yellow'
              className='mb-4'
              title={t('common.alert.warning', {})}
            >
              {t('common.alert.clockOffset', { offset: String(Math.round(timeOffset / 1000)) })}
            </Alert>
          )}

          <Stack>
            <Text>{t('pages.account.account.containers.twoFactor.modal.setupTwoFactor.description', {})}</Text>
            {!token ? (
              <Spinner.Centered />
            ) : (
              <div className='flex flex-col items-center justify-center my-4'>
                <div className='flex items-center justify-center w-56 h-56 p-2 bg-gray-50 shadow'>
                  <canvas ref={setCanvasRef}></canvas>
                </div>
                <div className='mt-2'>
                  <CopyOnClick content={token.secret}>
                    <Code>{token.secret.match(/.{1,4}/g)!.join(' ') || 'Loading...'}</Code>
                  </CopyOnClick>
                </div>
              </div>
            )}
            <Text>{t('pages.account.account.containers.twoFactor.modal.setupTwoFactor.descriptionQR', {})}</Text>

            <TextInput
              withAsterisk
              label={t('pages.account.account.containers.twoFactor.modal.setupTwoFactor.form.code', {})}
              placeholder='000000'
              autoComplete='one-time-code'
              {...form.getInputProps('code')}
            />

            <PasswordInput
              withAsterisk
              label={t('common.form.password', {})}
              placeholder={t('common.form.password', {})}
              autoComplete='current-password'
              {...form.getInputProps('password')}
            />

            <ModalFooter>
              <Button onClick={doEnable} loading={loading} disabled={!form.isValid()}>
                {t('common.button.enable', {})}
              </Button>
              <Button variant='default' onClick={() => stageStack.closeAll()}>
                {t('common.button.close', {})}
              </Button>
            </ModalFooter>
          </Stack>
        </Modal>
        <Modal
          {...stageStack.register('recovery')}
          onClose={() => {
            setUser({ ...user!, totpEnabled: true });
            stageStack.close('recovery');
          }}
          title={t('pages.account.account.containers.twoFactor.modal.recoveryCodes.title', {})}
        >
          <Stack>
            <Text>{t('pages.account.account.containers.twoFactor.modal.recoveryCodes.description', {})}</Text>
            <CopyOnClick content={recoveryCodes.join('\n')}>
              <Code block className='grid grid-cols-2 w-full gap-x-2'>
                {recoveryCodes.map((code, i) => (
                  <span key={code} className={i % 2 === 0 ? 'text-right' : 'text-left'}>
                    {code}
                  </span>
                ))}
              </Code>
            </CopyOnClick>

            <ModalFooter>
              <Button
                variant='default'
                onClick={() => {
                  setUser({ ...user!, totpEnabled: true });
                  stageStack.closeAll();
                }}
              >
                {t('common.button.close', {})}
              </Button>
            </ModalFooter>
          </Stack>
        </Modal>
      </MantineModal.Stack>

      <Button onClick={() => stageStack.open('setup')}>
        {t('pages.account.account.containers.twoFactor.button.setupTwoFactor', {})}
      </Button>
    </>
  );
}

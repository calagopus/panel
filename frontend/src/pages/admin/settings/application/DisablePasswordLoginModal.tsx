import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import getOAuthLinkProviders from '@/api/me/oauth-links/getOAuthLinkProviders.ts';
import getOAuthLinks from '@/api/me/oauth-links/getOAuthLinks.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

interface SignInOptions {
  providerCount: number;
  linkedProviders: string[];
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}

export default function DisablePasswordLoginModal({ opened, onClose, onConfirmed }: Props) {
  const { t, tReact } = useTranslations();
  const { user } = useAuth();
  const webauthnEnabled = useAdminStore((state) => state.webauthn.enabled);

  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!opened) return;

    setOptions(null);
    setFailed(false);
    Promise.all([getOAuthLinkProviders(), getOAuthLinks(1, 100)])
      .then(([providers, links]) => {
        const usable = new Set(providers.map((p) => p.uuid));
        setOptions({
          providerCount: providers.length,
          linkedProviders: [
            ...new Set(links.data.filter((l) => usable.has(l.oauthProvider.uuid)).map((l) => l.oauthProvider.name)),
          ],
        });
      })
      .catch(() => setFailed(true));
  }, [opened]);

  const hasSecurityKey = webauthnEnabled && Boolean(user?.twoFactorMethods.includes('security_key'));
  const blockReason = !options
    ? null
    : options.providerCount === 0
      ? t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.noProviders', {})
      : options.linkedProviders.length === 0 && !hasSecurityKey
        ? t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.noOptions', {})
        : null;

  return (
    <Modal
      title={t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.title', {})}
      opened={opened}
      onClose={onClose}
    >
      <Stack>
        {tReact('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.content', {})}

        {failed ? (
          <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
            {t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.checkFailed', {})}
          </Alert>
        ) : !options ? (
          t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.checking', {})
        ) : blockReason ? (
          <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
            {blockReason}
          </Alert>
        ) : (
          <div>
            {t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.yourOptions', {})}
            <ul className='list-disc pl-6'>
              {options.linkedProviders.map((provider) => (
                <li key={provider}>
                  {t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.oauthLink', { provider })}
                </li>
              ))}
              {hasSecurityKey && (
                <li>{t('pages.admin.settings.tabs.application.page.modal.disablePasswordLogin.securityKey', {})}</li>
              )}
            </ul>
          </div>
        )}
      </Stack>

      <ModalFooter>
        <Button color='red' disabled={(!options && !failed) || !!blockReason} onClick={onConfirmed}>
          {t('common.button.disable', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

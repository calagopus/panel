import { useState } from 'react';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function useLogoutConfirmation() {
  const { t } = useTranslations();
  const { impersonating, doLogout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const confirmLogout = () => (impersonating ? doLogout() : setLogoutConfirmOpen(true));

  const logoutModal = (
    <ConfirmationModal
      opened={logoutConfirmOpen}
      onClose={() => setLogoutConfirmOpen(false)}
      title={t('elements.sidebar.modal.logout.title', {})}
      confirm={t('elements.sidebar.button.logout', {})}
      onConfirmed={() => {
        setLogoutConfirmOpen(false);
        doLogout();
      }}
    >
      {t('elements.sidebar.modal.logout.content', {})}
    </ConfirmationModal>
  );

  return { confirmLogout, logoutModal };
}

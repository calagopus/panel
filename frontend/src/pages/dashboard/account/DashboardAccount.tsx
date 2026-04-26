import { faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Alert from '@/elements/Alert.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AccountContainer from './AccountContainer.tsx';
import AvatarContainer from './AvatarContainer.tsx';
import EmailContainer from './EmailContainer.tsx';
import PasswordContainer from './PasswordContainer.tsx';
import TwoFactorContainer from './TwoFactorContainer.tsx';

export interface AccountCardProps {
  requireTwoFactorActivation?: boolean;
}

export default function DashboardAccount() {
  const { t } = useTranslations();
  const { user } = useAuth();

  const requireTwoFactorActivation = Boolean(!user?.totpEnabled && user?.requireTwoFactor);

  return (
    <AccountContentContainer
      title={t('pages.account.account.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.account.container}
    >
      {requireTwoFactorActivation && (
        <Alert
          icon={<FontAwesomeIcon icon={faShieldAlt} />}
          title={t('pages.account.account.alert.requireTwoFactor.title', {})}
          color='red'
          mb='md'
        >
          {t('pages.account.account.alert.requireTwoFactor.description', {})}
        </Alert>
      )}

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {window.extensionContext.extensionRegistry.pages.dashboard.account.accountContainers.prependedComponents.map(
          (Component, i) => (
            <Component
              key={`account-accountContainer-prepended-${i}`}
              requireTwoFactorActivation={requireTwoFactorActivation}
            />
          ),
        )}

        <PasswordContainer requireTwoFactorActivation={requireTwoFactorActivation} />
        <EmailContainer requireTwoFactorActivation={requireTwoFactorActivation} />
        <TwoFactorContainer />
        <AccountContainer requireTwoFactorActivation={requireTwoFactorActivation} />
        <AvatarContainer requireTwoFactorActivation={requireTwoFactorActivation} />

        {window.extensionContext.extensionRegistry.pages.dashboard.account.accountContainers.appendedComponents.map(
          (Component, i) => (
            <Component
              key={`account-accountContainer-appended-${i}`}
              requireTwoFactorActivation={requireTwoFactorActivation}
            />
          ),
        )}
      </div>
    </AccountContentContainer>
  );
}

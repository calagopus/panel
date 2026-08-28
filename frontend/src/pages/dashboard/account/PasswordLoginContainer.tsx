import { faRightToBracket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import PasswordLoginToggleButton from './actions/PasswordLoginToggleButton.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function PasswordLoginContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { user } = useAuth();

  if (!user!.hasPassword) return null;

  return (
    <TitleCard
      title={t('pages.account.account.containers.passwordLogin.title', {})}
      icon={<FontAwesomeIcon icon={faRightToBracket} />}
      className={classNames('h-full order-40', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <Stack h='100%'>
        {user!.passwordLoginDisabled
          ? t('pages.account.account.containers.passwordLogin.disabled', {}).md()
          : t('pages.account.account.containers.passwordLogin.enabled', {}).md()}

        <div className='mt-auto'>
          <PasswordLoginToggleButton />
        </div>
      </Stack>
    </TitleCard>
  );
}

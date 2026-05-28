import { faMobilePhone } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack } from '@mantine/core';
import TitleCard from '@/elements/TitleCard.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TwoFactorDisableButton from './actions/TwoFactorDisableButton.tsx';
import TwoFactorSetupButton from './actions/TwoFactorSetupButton.tsx';

export default function TwoFactorContainer() {
  const { t, tReact } = useTranslations();
  const { user } = useAuth();

  return (
    <TitleCard
      title={t('pages.account.account.containers.twoFactor.title', {})}
      icon={<FontAwesomeIcon icon={faMobilePhone} />}
      className='h-full order-30'
    >
      <Stack h='100%'>
        {user!.totpEnabled
          ? t('pages.account.account.containers.twoFactor.twoFactorEnabled', {}).md()
          : t('pages.account.account.containers.twoFactor.twoFactorDisabled', {}).md()}
        {user?.totpLastUsed && (
          <span className='-mt-2 text-sm text-(--mantine-color-dimmed)'>
            {tReact('pages.account.account.containers.twoFactor.twoFactorLastUsed', {
              timestamp: <FormattedTimestamp timestamp={user.totpLastUsed} tooltipClassName='inline-block' />,
            })}
          </span>
        )}

        <div className='mt-auto'>{user!.totpEnabled ? <TwoFactorDisableButton /> : <TwoFactorSetupButton />}</div>
      </Stack>
    </TitleCard>
  );
}

import { faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import EmailTwoFactorToggleButton from './actions/EmailTwoFactorToggleButton.tsx';
import TwoFactorDisableButton from './actions/TwoFactorDisableButton.tsx';
import TwoFactorSetupButton from './actions/TwoFactorSetupButton.tsx';
import { useTwoFactorRequirement } from './useTwoFactorRequirement.ts';

export default function TwoFactorContainer() {
  const { t, tReact } = useTranslations();
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = useGlobalStore((state) => state.settings);
  const { methodLabel, isAccepted } = useTwoFactorRequirement();

  const methods = user!.twoFactorMethods;
  const locked = user!.requireTwoFactor && !user!.twoFactorSatisfied;

  const offerTotp = user!.totpEnabled || !locked || isAccepted('totp');
  const offerEmail =
    user!.emailTwoFactorEnabled || (settings.app.emailTwoFactorEnabled && (!locked || isAccepted('email')));
  const offerSecurityKeys = methods.includes('security_key') || !locked || isAccepted('security_key');

  return (
    <TitleCard
      title={t('pages.account.account.containers.twoFactor.title', {})}
      icon={<FontAwesomeIcon icon={faShieldHalved} />}
      className='h-full order-30'
    >
      <Stack h='100%'>
        {methods.length === 0 ? (
          t('pages.account.account.containers.twoFactor.none', {}).md()
        ) : (
          <Group gap='xs'>
            {methods.map((method) =>
              user!.requireTwoFactor && !isAccepted(method) ? (
                <Tooltip key={method} label={t('pages.account.account.containers.twoFactor.notAccepted', {})}>
                  <Badge color='gray'>{methodLabel(method)}</Badge>
                </Tooltip>
              ) : (
                <Badge key={method} color='green'>
                  {methodLabel(method)}
                </Badge>
              ),
            )}
          </Group>
        )}

        {user!.requireTwoFactor && (
          <Text c={user!.twoFactorSatisfied ? 'green' : 'red'} size='sm'>
            {user!.twoFactorSatisfied
              ? t('pages.account.account.containers.twoFactor.requirementMet', {})
              : t('pages.account.account.containers.twoFactor.requirementUnmet', {})}
          </Text>
        )}

        {user?.totpLastUsed && (
          <span className='-mt-2 text-sm text-(--mantine-color-dimmed)'>
            {tReact('pages.account.account.containers.twoFactor.twoFactorLastUsed', {
              timestamp: <FormattedTimestamp timestamp={user.totpLastUsed} tooltipClassName='inline-block' />,
            })}
          </span>
        )}

        <Group className='mt-auto' gap='xs'>
          {offerTotp && (user!.totpEnabled ? <TwoFactorDisableButton /> : <TwoFactorSetupButton />)}
          {offerEmail && <EmailTwoFactorToggleButton />}
          {offerSecurityKeys && (
            <Button variant='light' onClick={() => navigate('/account/security-keys')}>
              {t('pages.account.account.containers.twoFactor.button.securityKeys', {})}
            </Button>
          )}
        </Group>
      </Stack>
    </TitleCard>
  );
}

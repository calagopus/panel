import { faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { z } from 'zod';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import UserSettingScopeMenu from '@/elements/UserSettingScopeMenu.tsx';
import { userToastPosition } from '@/lib/schemas/user.ts';
import { START_ON_GROUPED_SERVERS_KEY, useStartOnGroupedServers } from '@/plugins/server/useStartOnGroupedServers.ts';
import { TOAST_POSITION_KEY, useToastPosition } from '@/plugins/toast/useToastPosition.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function PreferencesContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();

  const [toastPosition, setToastPosition] = useToastPosition();
  const [startOnGroupedServers, setStartOnGroupedServers] = useStartOnGroupedServers();

  return (
    <TitleCard
      title={t('pages.account.account.containers.preferences.title', {})}
      icon={<FontAwesomeIcon icon={faSliders} />}
      className={classNames('h-full order-55', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <Stack>
        <Select
          label={
            <>
              {t('pages.account.account.containers.preferences.form.toastPosition', {})}&nbsp;
              <UserSettingScopeMenu settingKey={TOAST_POSITION_KEY} value={toastPosition} />
            </>
          }
          data={[
            {
              label: t('common.enum.userToastPosition.topLeft', {}),
              value: 'top_left',
            },
            {
              label: t('common.enum.userToastPosition.topCenter', {}),
              value: 'top_center',
            },
            {
              label: t('common.enum.userToastPosition.topRight', {}),
              value: 'top_right',
            },
            {
              label: t('common.enum.userToastPosition.bottomLeft', {}),
              value: 'bottom_left',
            },
            {
              label: t('common.enum.userToastPosition.bottomCenter', {}),
              value: 'bottom_center',
            },
            {
              label: t('common.enum.userToastPosition.bottomRight', {}),
              value: 'bottom_right',
            },
          ]}
          value={toastPosition}
          onChange={(value) => value && setToastPosition(value as z.infer<typeof userToastPosition>)}
        />
        <Switch
          label={
            <>
              {t('pages.account.account.containers.preferences.form.startOnGroupedServers', {})}&nbsp;
              <UserSettingScopeMenu settingKey={START_ON_GROUPED_SERVERS_KEY} value={startOnGroupedServers} />
            </>
          }
          checked={startOnGroupedServers}
          onChange={(e) => setStartOnGroupedServers(e.target.checked)}
        />
      </Stack>
    </TitleCard>
  );
}

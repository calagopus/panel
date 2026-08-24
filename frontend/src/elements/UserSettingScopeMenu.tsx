import {
  faCheck,
  faCloud,
  faCloudArrowUp,
  faDesktop,
  faRotateLeft,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Fragment, ReactNode } from 'react';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Menu from '@/elements/Menu.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import { UserSettingValue } from '@/lib/schemas/user/settings.ts';
import {
  clearUserSettingOverride,
  overrideUserSettingLocally,
  pushUserSettingToAccount,
  UserSettingScope,
  useUserSettingScope,
  useUserSettingsLoaded,
} from '@/lib/userSettings.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface UserSettingScopeAction {
  id: 'account' | 'device' | 'useAccountValue' | 'saveToAccount';
  icon: IconDefinition;
  label: string;
  active: boolean;
  dividerBefore: boolean;
  onClick: () => void;
}

export function useUserSettingScopeActions(
  settingKey: string,
  value: UserSettingValue,
): { scope: UserSettingScope; available: boolean; actions: UserSettingScopeAction[] } {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { impersonating } = useAuth();
  const scope = useUserSettingScope(settingKey);
  const loaded = useUserSettingsLoaded();

  const saveToAccount = async () => {
    try {
      await pushUserSettingToAccount(settingKey);
      addToast(t('common.settingScope.toast.saved', {}), 'success');
    } catch {
      addToast(t('common.settingScope.toast.saveFailed', {}), 'error');
    }
  };

  const actions: UserSettingScopeAction[] = [
    {
      id: 'account',
      icon: faCloud,
      label: t('common.settingScope.account', {}),
      active: scope === 'account',
      dividerBefore: false,
      onClick: () => clearUserSettingOverride(settingKey),
    },
    {
      id: 'device',
      icon: faDesktop,
      label: t('common.settingScope.device', {}),
      active: scope === 'device',
      dividerBefore: false,
      onClick: () => overrideUserSettingLocally(settingKey, value),
    },
  ];

  if (scope === 'device') {
    actions.push(
      {
        id: 'useAccountValue',
        icon: faRotateLeft,
        label: t('common.settingScope.useAccountValue', {}),
        active: false,
        dividerBefore: true,
        onClick: () => clearUserSettingOverride(settingKey),
      },
      {
        id: 'saveToAccount',
        icon: faCloudArrowUp,
        label: t('common.settingScope.saveToAccount', {}),
        active: false,
        dividerBefore: false,
        onClick: saveToAccount,
      },
    );
  }

  return { scope, available: loaded && !impersonating, actions };
}

export default function UserSettingScopeMenu({
  settingKey,
  value,
  withinPortal = true,
  children,
}: {
  settingKey: string;
  value: UserSettingValue;
  withinPortal?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslations();
  const { scope, available, actions } = useUserSettingScopeActions(settingKey, value);

  return (
    <span
      className='inline-flex'
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Menu withinPortal={withinPortal} position='bottom-end' shadow='md' disabled={!available}>
        <Menu.Target>
          <Tooltip
            label={
              scope === 'device'
                ? t('common.settingScope.tooltip.device', {})
                : t('common.settingScope.tooltip.account', {})
            }
          >
            {children ? (
              <UnstyledButton disabled={!available} c={scope === 'device' ? 'blue' : undefined}>
                {children}
              </UnstyledButton>
            ) : (
              <ActionIcon size='xs' variant='subtle' color={scope === 'device' ? 'blue' : 'gray'} disabled={!available}>
                <FontAwesomeIcon icon={scope === 'device' ? faDesktop : faCloud} />
              </ActionIcon>
            )}
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          {actions.map((action) => (
            <Fragment key={action.id}>
              {action.dividerBefore && <Menu.Divider />}
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={action.icon} />}
                rightSection={action.active && <FontAwesomeIcon icon={faCheck} size='sm' />}
                disabled={action.active}
                onClick={action.onClick}
              >
                {action.label}
              </Menu.Item>
            </Fragment>
          ))}
        </Menu.Dropdown>
      </Menu>
    </span>
  );
}
